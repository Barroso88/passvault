CREATE TABLE IF NOT EXISTS vault (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) UNIQUE,
    master_hash VARCHAR(255),
    categories JSONB,
    passwords JSONB,
    cards JSONB
);