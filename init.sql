CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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
);

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
);
