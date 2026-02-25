"use strict";

const db  = require("../models/db.model.js");
const enc = require("../services/encryption.js");

/**
 * logIn
 * Verifica la contraseña contra el hash almacenado con scrypt.
 * Devuelve los datos con username descifrado.
 */

const logIn = async (req, res) => {
    try {
        const { username, password } = req.body;
        // El frontend envía el email en el campo 'username'
        const result = await db.pool.query(`SELECT * FROM users WHERE email = $1`, [username]);
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
 * Cifra el username con AES-256-GCM.
 * Almacena en BD sin ningún dato en texto plano.
 */

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Verificar duplicado por email
        const duplicates = await db.pool.query(`SELECT id FROM users WHERE email = $1`, [email]);

        if (duplicates.rows[0]) {
            return res.status(409).send({ message: "Duplicated Credentials" });
        }
        // Cifrar antes de almacenar
        const encryptedUsername = enc.encryptUsername(username);
        const hashedPassword    = await enc.hashPassword(password);

        await db.pool.query(`INSERT INTO users (username, email, password) VALUES ($1, $2, $3)`, [encryptedUsername, email, hashedPassword]);

        res.status(200).send({ message: "Successfully Registered" });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

module.exports = { logIn, register };