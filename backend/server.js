const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const USER_ID = 'admin_vault';
const USER_ID_BYTES = Buffer.from(USER_ID, 'utf8');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const WEBAUTHN_RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
const WEB_AUTHN_NAME = 'PassVault';

const pendingWebAuthn = {
    registration: null,
    finalize: null,
    login: null,
};

const toBase64Url = (value) => Buffer.from(value).toString('base64url');
const fromBase64Url = (value) => Buffer.from(value, 'base64url');
const toCredentialIdString = (value) => {
    if (typeof value === 'string') return value;
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return toBase64Url(value);
    }
    if (value && ArrayBuffer.isView(value)) {
        return toBase64Url(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
    if (value instanceof ArrayBuffer) {
        return toBase64Url(Buffer.from(value));
    }
    return '';
};

const normalizeJson = (value, fallback) => {
    if (value == null) return fallback;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
    return value;
};

async function ensureSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS vault (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) UNIQUE,
            master_hash VARCHAR(255),
            vault_salt TEXT,
            vault_version INTEGER DEFAULT 1,
            vault_key_wrap_master JSONB,
            webauthn_credentials JSONB,
            categories JSONB,
            passwords JSONB,
            cards JSONB
        )
    `);

    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS vault_salt TEXT');
    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS vault_version INTEGER DEFAULT 1');
    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS vault_key_wrap_master JSONB');
    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS webauthn_credentials JSONB');
}

async function callGemini(prompt, schema) {
    if (!GEMINI_API_KEY) {
        const err = new Error('GEMINI_API_KEY não configurada.');
        err.status = 503;
        throw err;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.error?.message || 'Falha ao contactar Gemini.');
        err.status = res.status;
        throw err;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        const err = new Error('Gemini devolveu uma resposta vazia.');
        err.status = 502;
        throw err;
    }

    return JSON.parse(text);
}

async function loadVault() {
    const result = await pool.query('SELECT * FROM vault WHERE user_id = $1', [USER_ID]);
    return result.rows[0] || null;
}

function getCredentials(vault) {
    return normalizeJson(vault?.webauthn_credentials, []);
}

function getCategoryName(category) {
    if (typeof category === 'string') return category;
    return category?.name || category?.title || '';
}

function isSystemCategory(name) {
    return name === 'Other';
}

function sortCategories(categories = []) {
    return (Array.isArray(categories) ? categories : [])
        .filter((category) => getCategoryName(category))
        .slice()
        .sort((a, b) => {
            const aName = getCategoryName(a);
            const bName = getCategoryName(b);
            const aSystem = isSystemCategory(aName);
            const bSystem = isSystemCategory(bName);
            if (aSystem && bSystem) return 0;
            if (aSystem) return 1;
            if (bSystem) return -1;
            return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
        });
}

function getMasterWrap(vault) {
    return vault?.vault_key_wrap_master || null;
}

function generatePrfSalt() {
    return Buffer.from(crypto.randomBytes(32)).toString('base64url');
}

function buildCredentialDescriptor(cred) {
    if (!cred?.id) {
        throw new Error('Credencial biométrica inválida.');
    }
    return {
        id: toCredentialIdString(cred.id),
        type: 'public-key',
        transports: cred.transports || undefined,
    };
}

function getCredentialCounter(credential) {
    const counter = Number(credential?.counter);
    return Number.isFinite(counter) && counter >= 0 ? counter : 0;
}

function verifyMasterHash(vault, hash) {
    if (!vault || vault.master_hash !== hash) {
        const err = new Error('Não autorizado.');
        err.status = 401;
        throw err;
    }
}

function currentOrigin(req) {
    return req.headers.origin || WEBAUTHN_ORIGIN;
}

// Status
app.get('/api/status', async (req, res) => {
    try {
        const vault = await loadVault();
        res.json({
            isSetup: !!vault,
            vaultSalt: vault?.vault_salt || null,
            vaultVersion: vault?.vault_version || 1,
            hasPasskeys: getCredentials(vault).some((cred) => cred.wrappedVaultKey && cred.wrappedMasterHash),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Setup
app.post('/api/setup', async (req, res) => {
    const { hash, salt, vaultKeyWrapMaster } = req.body;
    try {
        const check = await loadVault();
        if (check) return res.status(400).json({ error: 'Cofre já existe.' });

        await pool.query(
            'INSERT INTO vault (user_id, master_hash, vault_salt, vault_version, vault_key_wrap_master, webauthn_credentials, categories, passwords, cards) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [USER_ID, hash, salt || null, 2, vaultKeyWrapMaster || null, '[]', '[]', '[]', '[]']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login via master password
app.post('/api/login', async (req, res) => {
    const { hash } = req.body;
    try {
        const vault = await loadVault();
        if (!vault) return res.status(404).json({ error: 'Cofre não configurado.' });
        if (vault.master_hash !== hash) return res.status(401).json({ error: 'Password inválida.' });

        res.json({
            categories: sortCategories(normalizeJson(vault.categories, [])),
            passwords: vault.passwords,
            cards: vault.cards,
            vaultSalt: vault.vault_salt || null,
            vaultVersion: vault.vault_version || 1,
            vaultKeyWrapMaster: vault.vault_key_wrap_master || null,
            webauthnCredentials: getCredentials(vault),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sync vault changes
app.put('/api/sync', async (req, res) => {
    const { hash, categories, passwords, cards, vaultSalt, vaultVersion, vaultKeyWrapMaster, webauthnCredentials } = req.body;
    try {
        const vault = await loadVault();
        verifyMasterHash(vault, hash);

        const nextVersion = Number.isFinite(Number(vaultVersion)) ? Number(vaultVersion) : (vault.vault_version || 1);
        const nextWrap = typeof vaultKeyWrapMaster === 'undefined' ? vault.vault_key_wrap_master : vaultKeyWrapMaster;
        const nextCredentials = typeof webauthnCredentials === 'undefined'
            ? getCredentials(vault)
            : normalizeJson(webauthnCredentials, []);
        const nextCategories = sortCategories(normalizeJson(categories, []));

        await pool.query(
            'UPDATE vault SET categories = $1, passwords = $2, cards = $3, vault_salt = $4, vault_version = $5, vault_key_wrap_master = $6, webauthn_credentials = $7 WHERE user_id = $8',
            [
                JSON.stringify(nextCategories),
                JSON.stringify(passwords),
                JSON.stringify(cards),
                vaultSalt || vault.vault_salt || null,
                nextVersion,
                nextWrap ? JSON.stringify(nextWrap) : null,
                JSON.stringify(nextCredentials),
                USER_ID,
            ]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Legacy migration to vault v2
app.post('/api/migrate', async (req, res) => {
    const {
        oldHash,
        newHash,
        salt,
        categories,
        passwords,
        cards,
        vaultKeyWrapMaster,
        webauthnCredentials,
    } = req.body;
    try {
        const vault = await loadVault();
        if (!vault || vault.master_hash !== oldHash) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const nextCategories = sortCategories(normalizeJson(categories, []));
        const nextCredentials = typeof webauthnCredentials === 'undefined'
            ? getCredentials(vault)
            : normalizeJson(webauthnCredentials, []);
        await pool.query(
            'UPDATE vault SET master_hash = $1, vault_salt = $2, vault_version = 2, vault_key_wrap_master = $3, categories = $4, passwords = $5, cards = $6, webauthn_credentials = $7 WHERE user_id = $8',
            [
                newHash,
                salt,
                vaultKeyWrapMaster ? JSON.stringify(vaultKeyWrapMaster) : null,
                JSON.stringify(nextCategories),
                JSON.stringify(passwords),
                JSON.stringify(cards),
                JSON.stringify(nextCredentials),
                USER_ID,
            ]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Passkeys status
app.get('/api/passkeys/status', async (req, res) => {
    try {
        const vault = await loadVault();
        res.json({
            hasPasskeys: getCredentials(vault).some((cred) => cred.wrappedVaultKey),
            credentials: getCredentials(vault),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register passkey options
app.post('/api/passkeys/register/options', async (req, res) => {
    const { hash, label } = req.body || {};
    try {
        const vault = await loadVault();
        verifyMasterHash(vault, hash);

        const credentials = getCredentials(vault);
        const prfSalt = generatePrfSalt();
        const options = await generateRegistrationOptions({
            rpName: WEB_AUTHN_NAME,
            rpID: WEBAUTHN_RP_ID,
            userID: USER_ID_BYTES,
            userName: USER_ID,
            userDisplayName: 'PassVault',
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'required',
            },
            excludeCredentials: credentials.map(buildCredentialDescriptor),
        });

        pendingWebAuthn.registration = {
            challenge: options.challenge,
            prfSalt,
            label: label || 'Passkey',
        };

        res.json({ options, prfSalt });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/passkeys/register/verify', async (req, res) => {
    const { hash, response } = req.body || {};
    try {
        const vault = await loadVault();
        verifyMasterHash(vault, hash);
        if (!pendingWebAuthn.registration) {
            return res.status(400).json({ error: 'Nenhuma inscrição biométrica pendente.' });
        }

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: pendingWebAuthn.registration.challenge,
            expectedOrigin: currentOrigin(req),
            expectedRPID: WEBAUTHN_RP_ID,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({ error: 'Falha ao verificar a biometria.' });
        }

        const { credential, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        if (!credential?.id || !credential?.publicKey) {
            return res.status(500).json({ error: 'A credencial biométrica não devolveu chave pública.' });
        }
        const credentials = getCredentials(vault).filter((cred) => cred.id !== credential.id);
        credentials.push({
            id: credential.id,
            publicKey: toBase64Url(credential.publicKey),
            counter: getCredentialCounter({ counter }),
            label: pendingWebAuthn.registration.label,
            prfSalt: pendingWebAuthn.registration.prfSalt,
            wrappedVaultKey: null,
            wrappedMasterHash: null,
            transports: response?.response?.transports || [],
            credentialDeviceType,
            credentialBackedUp,
        });

        await pool.query(
            'UPDATE vault SET webauthn_credentials = $1 WHERE user_id = $2',
            [JSON.stringify(credentials), USER_ID]
        );

        const created = credentials.find((cred) => cred.id === credential.id);
        pendingWebAuthn.registration = null;
        res.json({ success: true, credential: created });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Finalize wrapping the vault key for the new credential
app.post('/api/passkeys/finish/options', async (req, res) => {
    const { hash, credentialId } = req.body || {};
    try {
        const vault = await loadVault();
        verifyMasterHash(vault, hash);
        const credential = getCredentials(vault).find((cred) => cred.id === credentialId);
        if (!credential) {
            return res.status(404).json({ error: 'Credencial biométrica não encontrada.' });
        }
        if (!credential.publicKey) {
            return res.status(500).json({ error: 'A credencial biométrica está incompleta.' });
        }

        const options = await generateAuthenticationOptions({
            rpID: WEBAUTHN_RP_ID,
            allowCredentials: [buildCredentialDescriptor(credential)],
            userVerification: 'required',
        });

        pendingWebAuthn.finalize = {
            challenge: options.challenge,
            credentialId,
        };

        res.json({ options, credential });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/passkeys/finish/verify', async (req, res) => {
    const { hash, response, wrappedVaultKey, wrappedMasterHash } = req.body || {};
    try {
        const vault = await loadVault();
        verifyMasterHash(vault, hash);
        if (!pendingWebAuthn.finalize) {
            return res.status(400).json({ error: 'Nenhuma finalização biométrica pendente.' });
        }

        const storedCredential = getCredentials(vault).find((cred) => cred.id === pendingWebAuthn.finalize.credentialId);
        if (!storedCredential) {
            return res.status(404).json({ error: 'Credencial biométrica não encontrada.' });
        }

        if (response?.id && response.id !== pendingWebAuthn.finalize.credentialId) {
            return res.status(400).json({ error: 'A credencial biométrica seleccionada não corresponde ao registo pendente.' });
        }
        if (!wrappedVaultKey || !wrappedMasterHash) {
            return res.status(400).json({ error: 'Dados biométricos incompletos.' });
        }

        const credentialId = pendingWebAuthn.finalize.credentialId;
        const credentials = getCredentials(vault).map((cred) => {
            if (cred.id !== credentialId) return cred;
            return {
                ...cred,
                counter: getCredentialCounter(cred),
                wrappedVaultKey,
                wrappedMasterHash,
            };
        });
        const updatedCredential = credentials.find((cred) => cred.id === credentialId);

        await pool.query(
            'UPDATE vault SET webauthn_credentials = $1 WHERE user_id = $2',
            [JSON.stringify(credentials), USER_ID]
        );

        pendingWebAuthn.finalize = null;
        res.json({ success: true, credential: updatedCredential });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Login via passkey
app.post('/api/passkeys/login/options', async (req, res) => {
    try {
        const vault = await loadVault();
        const credentials = getCredentials(vault).filter((cred) => cred.wrappedVaultKey && cred.wrappedMasterHash);
        if (!credentials.length) {
            return res.status(404).json({ error: 'Biometria não configurada.' });
        }

        const options = await generateAuthenticationOptions({
            rpID: WEBAUTHN_RP_ID,
            allowCredentials: credentials.map(buildCredentialDescriptor),
            userVerification: 'required',
        });

        pendingWebAuthn.login = {
            challenge: options.challenge,
        };

        res.json({
            options,
            credentials: credentials.map((cred) => ({
                id: cred.id,
                label: cred.label || 'Passkey',
                prfSalt: cred.prfSalt,
                wrappedVaultKey: cred.wrappedVaultKey,
                wrappedMasterHash: cred.wrappedMasterHash,
                publicKey: cred.publicKey || null,
                counter: getCredentialCounter(cred),
                transports: cred.transports || [],
                credentialDeviceType: cred.credentialDeviceType || null,
                credentialBackedUp: cred.credentialBackedUp || null,
            })),
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/passkeys/login/verify', async (req, res) => {
    const { response, credentialPublicKey } = req.body || {};
    try {
        const vault = await loadVault();
        const credentials = getCredentials(vault);
        if (!pendingWebAuthn.login) {
            return res.status(400).json({ error: 'Nenhum login biométrico pendente.' });
        }

        const selectedId = response?.id;
        const credential = credentials.find((cred) => cred.id === selectedId);
        if (!credential) {
            return res.status(404).json({ error: 'Credencial biométrica não encontrada.' });
        }
        const publicKey = credential.publicKey || credentialPublicKey;
        if (!publicKey) {
            return res.status(500).json({ error: 'A credencial biométrica está incompleta.' });
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: pendingWebAuthn.login.challenge,
            expectedOrigin: currentOrigin(req),
            expectedRPID: WEBAUTHN_RP_ID,
            credential: {
                id: credential.id,
                publicKey: fromBase64Url(publicKey),
                counter: getCredentialCounter(credential),
            },
        });

        if (!verification.verified || !verification.authenticationInfo) {
            return res.status(400).json({ error: 'Falha ao validar a biometria.' });
        }

        const nextCredentials = credentials.map((cred) => {
            if (cred.id !== credential.id) return cred;
            return { ...cred, counter: verification.authenticationInfo.newCounter };
        });

        await pool.query(
            'UPDATE vault SET webauthn_credentials = $1 WHERE user_id = $2',
            [JSON.stringify(nextCredentials), USER_ID]
        );

        pendingWebAuthn.login = null;
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/passkeys/disable', async (req, res) => {
    const { hash } = req.body || {};
    try {
        const vault = await loadVault();
        verifyMasterHash(vault, hash);

        await pool.query(
            'UPDATE vault SET webauthn_credentials = $1 WHERE user_id = $2',
            [JSON.stringify([]), USER_ID]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Gemini helper
app.post('/api/ai/generate', async (req, res) => {
    const { prompt, schema } = req.body || {};
    if (!prompt || !schema) {
        return res.status(400).json({ error: 'Prompt e schema são obrigatórios.' });
    }

    try {
        const result = await callGemini(prompt, schema);
        res.json({ result });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
ensureSchema()
    .then(() => {
        app.listen(PORT, () => console.log(`🚀 PassVault API a correr na porta ${PORT}`));
    })
    .catch((err) => {
        console.error('Falha ao inicializar o esquema da base de dados:', err);
        process.exit(1);
    });
