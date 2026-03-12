const db = require("../models/db.model.js");
const enc = require("../services/encryption.service.js");

/**
 * Handle user login.
 */
const logIn = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await db.pool.query(
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );

        const user = result.rows[0];

        if (!user || !(await enc.verifyPassword(password, user.password))) {
            return res.status(401).send({ message: "Credenciales incorrectas" });
        }
        delete user.password;
        res.status(200).send(user);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

/**
 * Handle user registration.
 */
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const duplicates = await db.pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );

        if (duplicates.rows[0]) {
            return res.status(409).send({ message: "Duplicated Credentials" });
        }

        const hashedPassword = await enc.hashPassword(password);

        const result = await db.pool.query(
            `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email`,
            [username, email, hashedPassword]
        );

        res.status(200).send({ message: "¡Cuenta creada con éxito!", user: result.rows[0] });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

module.exports = { logIn, register };