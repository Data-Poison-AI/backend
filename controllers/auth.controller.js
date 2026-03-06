const db = require("../models/db.model.js");
const enc = require("../services/encryption.js");

/**
 * Handle user login.
 */
const logIn = (req, res) => {
    try {
        const { username, password } = req.body;

        db.pool.query(
            `SELECT username, password, email FROM users`,
            async (err, respond) => {
                if (err) {
                    return res.status(500).send({ message: err.message });
                }
                const users = respond.rows;
                const user = users.find(u => u.username === username);
                if (!user || !(await enc.verifyPassword(password, user.password))) {
                    return res.status(401).send("Incorrect Credentials");
                }
                delete user.password;
                res.status(200).send(user);
            }
        );
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

        await db.pool.query(
            `INSERT INTO users (username, email, password) VALUES ($1, $2, $3)`,
            [username, email, hashedPassword]
        );

        res.status(200).send({ message: "Successfully Registered" });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

module.exports = { logIn, register };