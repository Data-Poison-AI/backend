require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "poisonteamiariwi",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "postgres",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Verify PostgreSQL connection.
 */
async function checkConnection() {
    let client;
    try {
        client = await pool.connect();
        await client.query("SELECT 1");
        return { ok: true, message: "PostgreSQL connected successfully" };
    } catch (error) {
        return { ok: false, message: `Connection error: ${error.message}` };
    } finally {
        if (client) client.release();
    }
}

/**
 * Create users table if it doesn't exist.
 */
async function initSchema() {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id                SERIAL        PRIMARY KEY,
            username          VARCHAR(512)  NOT NULL UNIQUE,
            email             VARCHAR(255)  NOT NULL UNIQUE,
            password          VARCHAR(512)  NOT NULL,
            created_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await pool.query(sql);
        console.log("Schema inicializado, tabla users verificada.");
    } catch (error) {
        console.error("Error al inicializar schema:", error.message);
        throw error;
    }
}

module.exports = { pool, checkConnection, initSchema };