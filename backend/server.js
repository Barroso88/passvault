const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_USER || '';
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || (process.env.SMTP_HOST ? 'smtp' : '')).toLowerCase();
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const REGISTRATION_CODE_TTL_MINUTES = Number(process.env.REGISTRATION_CODE_TTL_MINUTES || 15);
const REGISTRATION_MAX_ATTEMPTS = Number(process.env.REGISTRATION_MAX_ATTEMPTS || 5);

const pendingWebAuthn = {
    registration: null,
    finalize: null,
    login: null,
};

const toBase64Url = (value) => Buffer.from(value).toString('base64url');
const fromBase64Url = (value) => Buffer.from(value, 'base64url');
const normalizeIdentifier = (value = '') => String(value || '').trim().toLowerCase();
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

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const generateVerificationCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const hashVerificationCode = (code = '') => crypto.createHash('sha256').update(String(code)).digest('hex');

const createEmailTransport = () => {
    if (EMAIL_PROVIDER === 'smtp') {
        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
            throw new Error('Configuração SMTP incompleta.');
        }

        return nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASSWORD,
            },
        });
    }

    return null;
};

async function sendVerificationCodeEmail({ to, code }) {
    const transport = createEmailTransport();
    if (!transport) {
        throw new Error('Envio de email não configurado. Define SMTP_HOST/SMTP_USER/SMTP_PASSWORD.');
    }

    const subject = 'PassVault - Código de confirmação';
    const text = `O teu código de confirmação PassVault é: ${code}\n\nEste código expira em ${REGISTRATION_CODE_TTL_MINUTES} minutos.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px;">PassVault</h2>
        <p style="margin: 0 0 12px;">O teu código de confirmação é:</p>
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; padding: 16px 20px; background: #f3f4f6; border-radius: 12px; display: inline-block;">${code}</div>
        <p style="margin: 16px 0 0;">Este código expira em ${REGISTRATION_CODE_TTL_MINUTES} minutos.</p>
      </div>
    `;

    await transport.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html,
    });
}

async function ensureSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            email TEXT UNIQUE,
            username TEXT UNIQUE,
            password_hash VARCHAR(255),
            email_verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS registration_requests (
            id SERIAL PRIMARY KEY,
            identifier TEXT UNIQUE,
            email TEXT UNIQUE,
            username TEXT UNIQUE,
            master_hash VARCHAR(255),
            vault_salt TEXT,
            vault_version INTEGER DEFAULT 2,
            vault_key_wrap_master JSONB,
            code_hash VARCHAR(255),
            attempts INTEGER DEFAULT 0,
            expires_at TIMESTAMP,
            used_at TIMESTAMP,
            user_id VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS vaults (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            master_hash VARCHAR(255),
            vault_salt TEXT,
            vault_version INTEGER DEFAULT 1,
            vault_key_wrap_master JSONB,
            webauthn_credentials JSONB,
            categories JSONB,
            passwords JSONB,
            cards JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

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

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');

    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS identifier TEXT');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS email TEXT');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS username TEXT');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS master_hash VARCHAR(255)');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS vault_salt TEXT');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS vault_version INTEGER DEFAULT 2');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS vault_key_wrap_master JSONB');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS code_hash VARCHAR(255)');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS used_at TIMESTAMP');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()');
    await pool.query('ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');

    await pool.query('ALTER TABLE vaults ADD COLUMN IF NOT EXISTS vault_salt TEXT');
    await pool.query('ALTER TABLE vaults ADD COLUMN IF NOT EXISTS vault_version INTEGER DEFAULT 1');
    await pool.query('ALTER TABLE vaults ADD COLUMN IF NOT EXISTS vault_key_wrap_master JSONB');
    await pool.query('ALTER TABLE vaults ADD COLUMN IF NOT EXISTS webauthn_credentials JSONB');
    await pool.query('ALTER TABLE vaults ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()');
    await pool.query('ALTER TABLE vaults ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');

    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS vault_salt TEXT');
    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS vault_version INTEGER DEFAULT 1');
    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS vault_key_wrap_master JSONB');
    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS webauthn_credentials JSONB');

    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [USER_ID]);
    await pool.query('UPDATE users SET email_verified = TRUE WHERE id IN (SELECT user_id FROM vaults WHERE user_id IS NOT NULL)');

    const legacyVault = await pool.query('SELECT * FROM vault WHERE user_id = $1', [USER_ID]);
    const primaryVault = await pool.query('SELECT * FROM vaults WHERE user_id = $1', [USER_ID]);
    if (legacyVault.rows[0] && !primaryVault.rows[0]) {
        const vault = legacyVault.rows[0];
        await pool.query(
            'INSERT INTO users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()',
            [USER_ID, 'admin']
        );
        await pool.query(
            `INSERT INTO vaults (
                user_id, master_hash, vault_salt, vault_version, vault_key_wrap_master,
                webauthn_credentials, categories, passwords, cards
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id) DO UPDATE SET
                master_hash = EXCLUDED.master_hash,
                vault_salt = EXCLUDED.vault_salt,
                vault_version = EXCLUDED.vault_version,
                vault_key_wrap_master = EXCLUDED.vault_key_wrap_master,
                webauthn_credentials = EXCLUDED.webauthn_credentials,
                categories = EXCLUDED.categories,
                passwords = EXCLUDED.passwords,
                cards = EXCLUDED.cards,
                updated_at = NOW()`,
            [
                USER_ID,
                vault.master_hash,
                vault.vault_salt || null,
                vault.vault_version || 1,
                vault.vault_key_wrap_master ? JSON.stringify(vault.vault_key_wrap_master) : null,
                vault.webauthn_credentials ? JSON.stringify(vault.webauthn_credentials) : '[]',
                JSON.stringify(normalizeJson(vault.categories, [])),
                JSON.stringify(normalizeJson(vault.passwords, [])),
                JSON.stringify(normalizeJson(vault.cards, [])),
            ]
        );
    } else if (primaryVault.rows[0] && !legacyVault.rows[0]) {
        const vault = primaryVault.rows[0];
        await pool.query(
            'INSERT INTO users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()',
            [USER_ID, 'admin']
        );
        await pool.query(
            `INSERT INTO vault (
                user_id, master_hash, vault_salt, vault_version, vault_key_wrap_master,
                webauthn_credentials, categories, passwords, cards
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id) DO UPDATE SET
                master_hash = EXCLUDED.master_hash,
                vault_salt = EXCLUDED.vault_salt,
                vault_version = EXCLUDED.vault_version,
                vault_key_wrap_master = EXCLUDED.vault_key_wrap_master,
                webauthn_credentials = EXCLUDED.webauthn_credentials,
                categories = EXCLUDED.categories,
                passwords = EXCLUDED.passwords,
                cards = EXCLUDED.cards`,
            [
                USER_ID,
                vault.master_hash,
                vault.vault_salt || null,
                vault.vault_version || 1,
                vault.vault_key_wrap_master ? JSON.stringify(vault.vault_key_wrap_master) : null,
                vault.webauthn_credentials ? JSON.stringify(vault.webauthn_credentials) : '[]',
                JSON.stringify(normalizeJson(vault.categories, [])),
                JSON.stringify(normalizeJson(vault.passwords, [])),
                JSON.stringify(normalizeJson(vault.cards, [])),
            ]
        );
    }
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
  const primary = await pool.query('SELECT * FROM vaults WHERE user_id = $1', [USER_ID]);
  if (primary.rows[0]) return primary.rows[0];
  const legacy = await pool.query('SELECT * FROM vault WHERE user_id = $1', [USER_ID]);
  return legacy.rows[0] || null;
}

async function loadVaultByUserId(userId = USER_ID) {
    const primary = await pool.query('SELECT * FROM vaults WHERE user_id = $1', [userId]);
    if (primary.rows[0]) return primary.rows[0];
    const legacy = await pool.query('SELECT * FROM vault WHERE user_id = $1', [userId]);
    return legacy.rows[0] || null;
}

async function loadUserByIdentifier(identifier = '') {
    const normalized = normalizeIdentifier(identifier);
    if (!normalized) return null;

    const result = await pool.query(
        `SELECT id, email, username, email_verified
         FROM users
         WHERE LOWER(COALESCE(email, '')) = $1
            OR LOWER(COALESCE(username, '')) = $1
            OR LOWER(id) = $1
         LIMIT 1`,
        [normalized]
    );
    return result.rows[0] || null;
}

async function ensureUserVaultById(userId = USER_ID) {
    const vault = await loadVaultByUserId(userId);
    if (vault) return vault;

    const legacy = userId === USER_ID ? await loadVault() : null;
    if (!legacy) {
        return null;
    }

    await persistVaultRecord({
        userId,
        masterHash: legacy.master_hash,
        vaultSalt: legacy.vault_salt || null,
        vaultVersion: legacy.vault_version || 1,
        vaultKeyWrapMaster: legacy.vault_key_wrap_master || null,
        webauthnCredentials: getCredentials(legacy),
        categories: normalizeJson(legacy.categories, []),
        passwords: normalizeJson(legacy.passwords, []),
        cards: normalizeJson(legacy.cards, []),
    });

    return loadVaultByUserId(userId);
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

function isRegistrationExpired(row) {
    if (!row?.expires_at) return false;
    return new Date(row.expires_at).getTime() < Date.now();
}

function currentOrigin(req) {
    return req.headers.origin || WEBAUTHN_ORIGIN;
}

async function persistVaultRecord({
    userId = USER_ID,
    masterHash,
    vaultSalt = null,
    vaultVersion = 1,
    vaultKeyWrapMaster = null,
    webauthnCredentials = [],
    categories = [],
    passwords = [],
    cards = [],
    mirrorLegacy = true,
}) {
    const nextCategories = sortCategories(normalizeJson(categories, []));
    const nextPasswords = normalizeJson(passwords, []);
    const nextCards = normalizeJson(cards, []);
    const nextCredentials = normalizeJson(webauthnCredentials, []);

    await pool.query(
        'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET updated_at = NOW()',
        [userId]
    );

    await pool.query(
        `INSERT INTO vaults (
            user_id, master_hash, vault_salt, vault_version, vault_key_wrap_master,
            webauthn_credentials, categories, passwords, cards
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id) DO UPDATE SET
            master_hash = EXCLUDED.master_hash,
            vault_salt = EXCLUDED.vault_salt,
            vault_version = EXCLUDED.vault_version,
            vault_key_wrap_master = EXCLUDED.vault_key_wrap_master,
            webauthn_credentials = EXCLUDED.webauthn_credentials,
            categories = EXCLUDED.categories,
            passwords = EXCLUDED.passwords,
            cards = EXCLUDED.cards,
            updated_at = NOW()`,
        [
            userId,
            masterHash,
            vaultSalt,
            vaultVersion,
            vaultKeyWrapMaster ? JSON.stringify(vaultKeyWrapMaster) : null,
            JSON.stringify(nextCredentials),
            JSON.stringify(nextCategories),
            JSON.stringify(nextPasswords),
            JSON.stringify(nextCards),
        ]
    );

    if (mirrorLegacy) {
        await pool.query(
            `INSERT INTO vault (
                user_id, master_hash, vault_salt, vault_version, vault_key_wrap_master,
                webauthn_credentials, categories, passwords, cards
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id) DO UPDATE SET
                master_hash = EXCLUDED.master_hash,
                vault_salt = EXCLUDED.vault_salt,
                vault_version = EXCLUDED.vault_version,
                vault_key_wrap_master = EXCLUDED.vault_key_wrap_master,
                webauthn_credentials = EXCLUDED.webauthn_credentials,
                categories = EXCLUDED.categories,
                passwords = EXCLUDED.passwords,
                cards = EXCLUDED.cards`,
            [
                userId,
                masterHash,
                vaultSalt,
                vaultVersion,
                vaultKeyWrapMaster ? JSON.stringify(vaultKeyWrapMaster) : null,
                JSON.stringify(nextCredentials),
                JSON.stringify(nextCategories),
                JSON.stringify(nextPasswords),
                JSON.stringify(nextCards),
            ]
        );
    }

    return {
        userId,
        masterHash,
        vaultSalt,
        vaultVersion,
        vaultKeyWrapMaster,
        webauthnCredentials: nextCredentials,
        categories: nextCategories,
        passwords: nextPasswords,
        cards: nextCards,
    };
}

// Status
app.get('/api/status', async (req, res) => {
    try {
        const { userId, identifier } = req.query || {};
        let vault = null;
        let user = null;
        let pendingRegistration = null;

        if (identifier) {
            user = await loadUserByIdentifier(identifier);
            vault = user ? await loadVaultByUserId(user.id) : null;
            pendingRegistration = await pool.query('SELECT identifier, expires_at, used_at FROM registration_requests WHERE identifier = $1', [normalizeEmail(identifier)]).then((r) => r.rows[0] || null);
        } else if (userId) {
            vault = await loadVaultByUserId(userId);
            user = vault ? await pool.query('SELECT id, email, username FROM users WHERE id = $1', [userId]).then((r) => r.rows[0] || null) : null;
        } else {
            vault = await loadVault();
            user = vault ? await pool.query('SELECT id, email, username FROM users WHERE id = $1', [USER_ID]).then((r) => r.rows[0] || null) : null;
        }

        res.json({
            isSetup: !!vault,
            user: user ? { id: user.id, email: user.email || null, username: user.username || null } : null,
            vaultSalt: vault?.vault_salt || null,
            vaultVersion: vault?.vault_version || 1,
            hasPasskeys: getCredentials(vault).some((cred) => cred.wrappedVaultKey && cred.wrappedMasterHash),
            registrationPending: !!(pendingRegistration && !pendingRegistration.used_at),
            registrationExpiresAt: pendingRegistration?.expires_at || null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function startRegistrationRequest({ identifier, hash, salt, vaultKeyWrapMaster }) {
    const normalized = normalizeEmail(identifier);
    if (!normalized || !isValidEmail(normalized)) {
        const err = new Error('É necessário um email válido para criar a conta.');
        err.status = 400;
        throw err;
    }

    const existingUser = await loadUserByIdentifier(normalized);
    if (existingUser?.email_verified) {
        const err = new Error('Esse email já tem uma conta verificada.');
        err.status = 409;
        throw err;
    }

    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + REGISTRATION_CODE_TTL_MINUTES * 60000);
    const requestResult = await pool.query(
        `INSERT INTO registration_requests (
            identifier, email, master_hash, vault_salt, vault_version, vault_key_wrap_master,
            code_hash, attempts, expires_at, used_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, NULL, NOW())
        ON CONFLICT (identifier) DO UPDATE SET
            email = EXCLUDED.email,
            master_hash = EXCLUDED.master_hash,
            vault_salt = EXCLUDED.vault_salt,
            vault_version = EXCLUDED.vault_version,
            vault_key_wrap_master = EXCLUDED.vault_key_wrap_master,
            code_hash = EXCLUDED.code_hash,
            attempts = 0,
            expires_at = EXCLUDED.expires_at,
            used_at = NULL,
            updated_at = NOW()
        RETURNING *`,
        [
            normalized,
            normalized,
            hash,
            salt || null,
            2,
            vaultKeyWrapMaster ? JSON.stringify(vaultKeyWrapMaster) : null,
            codeHash,
            expiresAt,
        ]
    );

    await sendVerificationCodeEmail({ to: normalized, code });
    return {
        success: true,
        verificationRequired: true,
        identifier: normalized,
        expiresAt: requestResult.rows[0]?.expires_at || expiresAt,
    };
}

app.post('/api/setup', async (req, res) => {
    try {
        const result = await startRegistrationRequest(req.body || {});
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/register/start', async (req, res) => {
    try {
        const result = await startRegistrationRequest(req.body || {});
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/register/resend', async (req, res) => {
    const { identifier } = req.body || {};
    try {
        const normalized = normalizeEmail(identifier);
        if (!normalized) {
            return res.status(400).json({ error: 'Email inválido.' });
        }

        const request = await pool.query('SELECT * FROM registration_requests WHERE identifier = $1', [normalized]);
        const pending = request.rows[0];
        if (!pending) {
            return res.status(404).json({ error: 'Não existe um pedido de registo pendente.' });
        }
        if (pending.used_at) {
            return res.status(409).json({ error: 'Esse email já foi confirmado.' });
        }
        if (isRegistrationExpired(pending)) {
            return res.status(410).json({ error: 'O código de confirmação expirou. Cria um novo registo.' });
        }

        const code = generateVerificationCode();
        const codeHash = hashVerificationCode(code);
        const expiresAt = new Date(Date.now() + REGISTRATION_CODE_TTL_MINUTES * 60000);

        await pool.query(
            `UPDATE registration_requests
             SET code_hash = $2, attempts = 0, expires_at = $3, updated_at = NOW()
             WHERE identifier = $1`,
            [normalized, codeHash, expiresAt]
        );

        await sendVerificationCodeEmail({ to: normalized, code });
        res.json({ success: true, verificationRequired: true, identifier: normalized, expiresAt });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/register/verify', async (req, res) => {
    const { identifier, code } = req.body || {};
    try {
        const normalized = normalizeEmail(identifier);
        if (!normalized || !code) {
            return res.status(400).json({ error: 'Email e código são obrigatórios.' });
        }

        const request = await pool.query('SELECT * FROM registration_requests WHERE identifier = $1', [normalized]);
        const pending = request.rows[0];
        if (!pending) {
            return res.status(404).json({ error: 'Não existe um pedido pendente para este email.' });
        }
        if (pending.used_at) {
            return res.status(409).json({ error: 'Esse email já foi confirmado.' });
        }
        if (isRegistrationExpired(pending)) {
            return res.status(410).json({ error: 'O código de confirmação expirou. Pede um novo código.' });
        }
        if (Number(pending.attempts || 0) >= REGISTRATION_MAX_ATTEMPTS) {
            return res.status(429).json({ error: 'Demasiadas tentativas. Pede um novo código.' });
        }
        if (hashVerificationCode(code) !== pending.code_hash) {
            await pool.query(
                'UPDATE registration_requests SET attempts = attempts + 1, updated_at = NOW() WHERE identifier = $1',
                [normalized]
            );
            return res.status(401).json({ error: 'Código de confirmação inválido.' });
        }

        const userId = crypto.randomUUID();
        await pool.query(
            'INSERT INTO users (id, email, username, email_verified) VALUES ($1, $2, $3, TRUE) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, username = EXCLUDED.username, email_verified = TRUE, updated_at = NOW()',
            [userId, normalized, null]
        );

        await persistVaultRecord({
            userId,
            masterHash: pending.master_hash,
            vaultSalt: pending.vault_salt || null,
            vaultVersion: pending.vault_version || 2,
            vaultKeyWrapMaster: pending.vault_key_wrap_master || null,
            webauthnCredentials: [],
            categories: [],
            passwords: [],
            cards: [],
        });

        await pool.query(
            `UPDATE registration_requests
             SET used_at = NOW(), user_id = $2, updated_at = NOW()
             WHERE identifier = $1`,
            [normalized, userId]
        );

        const user = await loadUserByIdentifier(normalized);
        const vault = await loadVaultByUserId(userId);
        res.json({
            success: true,
            user: user ? { id: user.id, email: user.email || null, username: user.username || null } : null,
            userId,
            categories: sortCategories(normalizeJson(vault?.categories, [])),
            passwords: normalizeJson(vault?.passwords, []),
            cards: normalizeJson(vault?.cards, []),
            vaultSalt: vault?.vault_salt || null,
            vaultVersion: vault?.vault_version || 2,
            vaultKeyWrapMaster: vault?.vault_key_wrap_master || null,
            webauthnCredentials: getCredentials(vault),
            verificationRequired: false,
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Login via master password
app.post('/api/login', async (req, res) => {
    const { identifier, userId, hash } = req.body;
    try {
        const normalized = normalizeIdentifier(identifier);
        const user = normalized
            ? await loadUserByIdentifier(normalized)
            : (userId ? await pool.query('SELECT id, email, username FROM users WHERE id = $1', [userId]).then((r) => r.rows[0] || null) : null);
        if (!normalized && !userId) {
            return res.status(400).json({ error: 'Identificador do utilizador é obrigatório.' });
        }
        if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
        if (user.email_verified === false) {
            return res.status(403).json({ error: 'Conta ainda não verificada. Confirma o email primeiro.' });
        }

        const vault = await loadVaultByUserId(user.id);
        if (!vault) return res.status(404).json({ error: 'Cofre não configurado.' });
        if (vault.master_hash !== hash) return res.status(401).json({ error: 'Password inválida.' });

        res.json({
            user: { id: user.id, email: user.email || null, username: user.username || null },
            categories: sortCategories(normalizeJson(vault.categories, [])),
            passwords: normalizeJson(vault.passwords, []),
            cards: normalizeJson(vault.cards, []),
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
    const { userId = USER_ID, hash, categories, passwords, cards, vaultSalt, vaultVersion, vaultKeyWrapMaster, webauthnCredentials } = req.body;
    try {
        const vault = await ensureUserVaultById(userId);
        if (!vault) return res.status(404).json({ error: 'Utilizador não encontrado.' });
        verifyMasterHash(vault, hash);

        const nextVersion = Number.isFinite(Number(vaultVersion)) ? Number(vaultVersion) : (vault.vault_version || 1);
        const nextWrap = typeof vaultKeyWrapMaster === 'undefined' ? vault.vault_key_wrap_master : vaultKeyWrapMaster;
        const nextCredentials = typeof webauthnCredentials === 'undefined'
            ? getCredentials(vault)
            : normalizeJson(webauthnCredentials, []);
        await persistVaultRecord({
            userId,
            masterHash: vault.master_hash,
            vaultSalt: vaultSalt || vault.vault_salt || null,
            vaultVersion: nextVersion,
            vaultKeyWrapMaster: nextWrap || null,
            webauthnCredentials: nextCredentials,
            categories,
            passwords,
            cards,
        });
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Legacy migration to vault v2
app.post('/api/migrate', async (req, res) => {
    const {
        userId = USER_ID,
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
        const vault = await ensureUserVaultById(userId);
        if (!vault || vault.master_hash !== oldHash) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const nextCategories = sortCategories(normalizeJson(categories, []));
        const nextCredentials = typeof webauthnCredentials === 'undefined'
            ? getCredentials(vault)
            : normalizeJson(webauthnCredentials, []);
        await persistVaultRecord({
            userId,
            masterHash: newHash,
            vaultSalt: salt,
            vaultVersion: 2,
            vaultKeyWrapMaster: vaultKeyWrapMaster || null,
            webauthnCredentials: nextCredentials,
            categories: nextCategories,
            passwords,
            cards,
        });

        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Passkeys status
app.get('/api/passkeys/status', async (req, res) => {
    try {
        const { userId = USER_ID, identifier = '' } = req.query || {};
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
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
    const { userId = USER_ID, identifier = '', hash, label } = req.body || {};
    try {
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
        verifyMasterHash(vault, hash);

        const credentials = getCredentials(vault);
        const prfSalt = generatePrfSalt();
        const options = await generateRegistrationOptions({
            rpName: WEB_AUTHN_NAME,
            rpID: WEBAUTHN_RP_ID,
            userID: Buffer.from((resolvedUser?.id || userId), 'utf8'),
            userName: resolvedUser?.email || resolvedUser?.username || userId,
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
    const { userId = USER_ID, identifier = '', hash, response } = req.body || {};
    try {
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
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

        await persistVaultRecord({
            userId: resolvedUser?.id || userId,
            masterHash: vault.master_hash,
            vaultSalt: vault.vault_salt || null,
            vaultVersion: vault.vault_version || 1,
            vaultKeyWrapMaster: vault.vault_key_wrap_master || null,
            webauthnCredentials: credentials,
            categories: normalizeJson(vault.categories, []),
            passwords: normalizeJson(vault.passwords, []),
            cards: normalizeJson(vault.cards, []),
        });

        const created = credentials.find((cred) => cred.id === credential.id);
        pendingWebAuthn.registration = null;
        res.json({ success: true, credential: created });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Finalize wrapping the vault key for the new credential
app.post('/api/passkeys/finish/options', async (req, res) => {
    const { userId = USER_ID, identifier = '', hash, credentialId } = req.body || {};
    try {
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
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
    const { userId = USER_ID, identifier = '', hash, response, wrappedVaultKey, wrappedMasterHash } = req.body || {};
    try {
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
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

        await persistVaultRecord({
            userId: resolvedUser?.id || userId,
            masterHash: vault.master_hash,
            vaultSalt: vault.vault_salt || null,
            vaultVersion: vault.vault_version || 1,
            vaultKeyWrapMaster: vault.vault_key_wrap_master || null,
            webauthnCredentials: credentials,
            categories: normalizeJson(vault.categories, []),
            passwords: normalizeJson(vault.passwords, []),
            cards: normalizeJson(vault.cards, []),
        });

        pendingWebAuthn.finalize = null;
        res.json({ success: true, credential: updatedCredential });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Login via passkey
app.post('/api/passkeys/login/options', async (req, res) => {
    try {
        const { userId = USER_ID, identifier = '' } = req.body || {};
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
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
    const { userId = USER_ID, identifier = '', response, credentialPublicKey } = req.body || {};
    try {
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
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

        await persistVaultRecord({
            userId: resolvedUser?.id || userId,
            masterHash: vault.master_hash,
            vaultSalt: vault.vault_salt || null,
            vaultVersion: vault.vault_version || 1,
            vaultKeyWrapMaster: vault.vault_key_wrap_master || null,
            webauthnCredentials: nextCredentials,
            categories: normalizeJson(vault.categories, []),
            passwords: normalizeJson(vault.passwords, []),
            cards: normalizeJson(vault.cards, []),
        });

        pendingWebAuthn.login = null;
        res.json({ success: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/passkeys/disable', async (req, res) => {
    const { userId = USER_ID, identifier = '', hash } = req.body || {};
    try {
        const resolvedUser = identifier ? await loadUserByIdentifier(identifier) : null;
        const vault = await ensureUserVaultById(resolvedUser?.id || userId);
        verifyMasterHash(vault, hash);

        await persistVaultRecord({
            userId: resolvedUser?.id || userId,
            masterHash: vault.master_hash,
            vaultSalt: vault.vault_salt || null,
            vaultVersion: vault.vault_version || 1,
            vaultKeyWrapMaster: vault.vault_key_wrap_master || null,
            webauthnCredentials: [],
            categories: normalizeJson(vault.categories, []),
            passwords: normalizeJson(vault.passwords, []),
            cards: normalizeJson(vault.cards, []),
        });

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
