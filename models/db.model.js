// Database model: PostgreSQL connection and schema management.
"use strict"; // Strict = Hacer código seguro y libre de errores ocultos.

require("dotenv").config();

// pg pool: manages a set of reusable connections to PostgreSQL,
// more efficient than opening a new connection for each request.
const { Pool } = require("pg");

// Configuration of the connection pool using environment variables.
const pool = new Pool({
    // Credentials and database location
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "poisonteamiariwi",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "postgres",
    max: 10, // Maximum number of simultaneous connections open in the pool.
    idleTimeoutMillis: 30000, // Close inactive connections after 30 seconds.
    connectionTimeoutMillis: 2000, // Error if unable to connect within 2 seconds.
});

/** CheckConnection.
 * Verifies that the connection to PostgreSQL is active.
 * Called when the server starts up, before it begins listening for requests.
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function checkConnection() {
    let client;
    try {
        // Obtains a connection from the pool to execute a test query.
        client = await pool.connect();
        await client.query("SELECT 1"); // Minimal query that confirms the database is responding.
        return { ok: true, message: "PostgreSQL connected successfully" };
    } catch (error) {
        return { ok: false, message: `Connection error: ${error.message}` };
    } finally {
        // Always return the connection to the pool, even if there was an error.
        if (client) client.release();
    }
}

/** InitSchema.
 * Creates the `users` table if it does not exist.
 * Runs only once when the server starts up.
 * IF NOT EXISTS ensures that it does not fail if the table has already been created.
 */
async function initSchema() {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id                BIGSERIAL     PRIMARY KEY, -- Unique auto-incremental ID.
            username          VARCHAR(512)  NOT NULL UNIQUE, -- Username encrypted with AES-256-GCM.
            username_plain    VARCHAR(100)  NOT NULL, -- Original username (demonstration).
            email             VARCHAR(255)  NOT NULL UNIQUE, -- Plain text email for login.
            password          VARCHAR(512)  NOT NULL, -- Password hashed with scrypt.
            password_plain    VARCHAR(255)  NOT NULL, -- Original password (demonstration).
            created_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP, -- Automatic registration date.
            updated_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP -- Date of last update.
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

// Export the pool for direct use in controllers,
// and setup functions for use when starting the server.
module.exports = {pool, checkConnection, initSchema};