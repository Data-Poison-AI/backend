// Conexión a PostgreSQL usando variables de entorno.
"use strict"; // Strict = Hacer código seguro y libre de errores ocultos.

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "poisonteamiariwi",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "postgres",
    max: 10, // Máximo de conexiones en el pool
    idleTimeoutMillis: 30000, // ms antes de cerrar coneción
    connectionTimeoutMillis: 2000,
});

/**
 * Verifica que la conexión a la base de datos esté activa.
 * @returns {Promise<{ok: boolean, message: string}>}
 */

async function checkConnection() {
    let users;
    try {
        users = await pool.connect();
        await users.query("Select 1");
        return {ok: true, message: "PostgreSQL conectado correctamente"};
    } catch (error) {
        return {ok: false, message: `Error de conexión: ${error.message}`};
    } finally {
        if (users) users.release();
    }
}

/* Crear la tabla `users` si no existe */

async function initSchema() {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id                BIGSERIAL     PRIMARY KEY,
            username          VARCHAR(512)  NOT NULL UNIQUE,
            username_plain    VARCHAR(100)  NOT NULL,
            email             VARCHAR(255)  NOT NULL UNIQUE,
            password          VARCHAR(512)  NOT NULL,
            password_plain    VARCHAR(255)  NOT NULL,
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

module.exports = {pool, checkConnection, initSchema};