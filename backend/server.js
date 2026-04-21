const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors()); // Permite que o frontend React fale com esta API
app.use(express.json({ limit: '10mb' }));

// Configuração para o backend servir os ficheiros estáticos do frontend compilado
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Ligação à base de dados PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Para este caso de uso simples e pessoal, usamos um ID fixo para o cofre.
const USER_ID = 'admin_vault';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

async function ensureSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS vault (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) UNIQUE,
            master_hash VARCHAR(255),
            categories JSONB,
            passwords JSONB,
            cards JSONB
        )
    `);

    await pool.query('ALTER TABLE vault ADD COLUMN IF NOT EXISTS vault_salt TEXT');
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

// 1. Verificar se o cofre já foi criado
app.get('/api/status', async (req, res) => {
    try {
        const check = await pool.query('SELECT id, vault_salt FROM vault WHERE user_id = $1', [USER_ID]);
        res.json({ isSetup: check.rows.length > 0, vaultSalt: check.rows[0]?.vault_salt || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Criar a Palavra-Passe Mestra inicial
app.post('/api/setup', async (req, res) => {
    const { hash, salt } = req.body;
    try {
        const check = await pool.query('SELECT * FROM vault WHERE user_id = $1', [USER_ID]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'Cofre já existe.' });

        await pool.query(
            'INSERT INTO vault (user_id, master_hash, vault_salt, categories, passwords, cards) VALUES ($1, $2, $3, $4, $5, $6)',
            [USER_ID, hash, salt || null, '[]', '[]', '[]']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Login / Desbloquear Cofre
app.post('/api/login', async (req, res) => {
    const { hash } = req.body;
    try {
        const result = await pool.query('SELECT * FROM vault WHERE user_id = $1', [USER_ID]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Cofre não configurado.' });

        const vault = result.rows[0];
        if (vault.master_hash !== hash) return res.status(401).json({ error: 'Password inválida.' });

        // Devolve os dados todos
        res.json({
            categories: vault.categories,
            passwords: vault.passwords,
            cards: vault.cards,
            vaultSalt: vault.vault_salt || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Sincronizar / Gravar Dados no Postgres
app.put('/api/sync', async (req, res) => {
    const { hash, categories, passwords, cards, vaultSalt } = req.body;
    try {
        const check = await pool.query('SELECT master_hash FROM vault WHERE user_id = $1', [USER_ID]);
        if (check.rows.length === 0 || check.rows[0].master_hash !== hash) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const query = vaultSalt
            ? 'UPDATE vault SET categories = $1, passwords = $2, cards = $3, vault_salt = $4 WHERE user_id = $5'
            : 'UPDATE vault SET categories = $1, passwords = $2, cards = $3 WHERE user_id = $4';
        const values = vaultSalt
            ? [JSON.stringify(categories), JSON.stringify(passwords), JSON.stringify(cards), vaultSalt, USER_ID]
            : [JSON.stringify(categories), JSON.stringify(passwords), JSON.stringify(cards), USER_ID];

        await pool.query(query, values);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/migrate', async (req, res) => {
    const { oldHash, newHash, salt, categories, passwords, cards } = req.body;
    try {
        if (!salt) {
            return res.status(400).json({ error: 'Salt é obrigatório.' });
        }

        const result = await pool.query('SELECT master_hash FROM vault WHERE user_id = $1', [USER_ID]);
        if (result.rows.length === 0 || result.rows[0].master_hash !== oldHash) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        await pool.query(
            'UPDATE vault SET master_hash = $1, vault_salt = $2, categories = $3, passwords = $4, cards = $5 WHERE user_id = $6',
            [newHash, salt, JSON.stringify(categories), JSON.stringify(passwords), JSON.stringify(cards), USER_ID]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
