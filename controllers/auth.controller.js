"use strict";

const db = require("../models/db.model.js");
const enc = require("../services/encryption.js");

/**
 * logIn
 * Busca por email, verifica password con hash almacenado,
 * devuelve datos con username descifrado.
 */
const logIn = async (req, res) => {
    try {
        const { username, password } = req.body;

        // El frontend envía el email en el campo 'username'
        const result = await db.pool.query(
            `SELECT * FROM users WHERE email = $1`,
            [username]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(401).send("Incorrect Credentials");
        }

        // Verificar contraseña contra hash almacenado
        const passwordMatch = await enc.verifyPassword(password, user.password);

        if (!passwordMatch) {
            return res.status(401).send("Incorrect Credentials");
        }

        // Descifrar username antes de enviar en la respuesta
        const safeUser = enc.decryptUserRows([user]);
        res.status(200).send(safeUser);

    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

/**
 * register
 * Guarda el valor original en username_plain y password_plain,
 * y el valor cifrado/hasheado en username y password.
 */
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Verificar duplicado por email
        const duplicates = await db.pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );

        if (duplicates.rows[0]) {
            return res.status(409).send({ message: "Duplicated Credentials" });
        }

        // Cifrar username y hashear password
        const encryptedUsername = enc.encryptUsername(username);
        const hashedPassword = await enc.hashPassword(password);

        // Insertar: columna cifrada + columna original (para demostración)
        await db.pool.query(
            `INSERT INTO users (username, username_plain, email, password, password_plain) VALUES ($1, $2, $3, $4, $5)`, [encryptedUsername, username, email, hashedPassword, password]
        );

        res.status(200).send({ message: "Successfully Registered" });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

module.exports = { logIn, register };