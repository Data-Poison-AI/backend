"use strict"; // Enable strict mode: prevents silent errors and the use of undeclared variables.

const db = require("../models/db.model.js"); // Access to the connection pool and database model functions.
const enc = require("../services/encryption.js"); // Encryption service: password hashing and username encryption/decryption.

/**
 * Login controller.
 * The frontend sends the user's email in the `username` field.
 * It searches by email, verifies the password hash,
 * and returns the user with the decrypted username.
 */
const logIn = async (req, res) => {
    try {
        const { username, password } = req.body; // Extract credentials from the request body.

        // Search for the user by email using a parameterized query ($1) to prevent SQL injection.
        const result = await db.pool.query(
            `SELECT * FROM users WHERE email = $1`,
            [username]
        );
        const user = result.rows[0]; // Take the first result (it should be unique due to the UNIQUE email).

        // If no user with that email exists, respond with 401 without revealing whether the email exists or not.
        if (!user) {
            return res.status(401).send("Incorrect Credentials");
        }

        // Compare the entered password against the hash stored in the database
        // using scrypt with timingSafeEqual to prevent timing attacks.
        const passwordMatch = await enc.verifyPassword(password, user.password);

        if (!passwordMatch) {
            return res.status(401).send("Incorrect Credentials");
        }

        // Decrypt the username (encrypted with AES-256-GCM) before sending it to the frontend.
        const safeUser = enc.decryptUserRows([user]);
        res.status(200).send(safeUser);

    } catch (err) {
        res.status(500).send({ message: err.message }); // Internal server error: the message is sent without a stack trace.
    }
};

/**
 * User registration controller.
 * Verifies that the email is not duplicated, encrypts the username
 * with AES-256-GCM, hashes the password with scrypt, and saves
 * both the encrypted and original values in the database (for demonstration purposes).
 */
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body; // Extract the data from the registration form.

        // Check for duplicates by searching only by email (the only plain text field that can be queried directly).
        const duplicates = await db.pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );

        // If a user with that email already exists, respond with 409 Conflict.
        if (duplicates.rows[0]) {
            return res.status(409).send({ message: "Duplicated Credentials" });
        }

        const encryptedUsername = enc.encryptUsername(username); // Encrypt the username with AES-256-GCM using a random IV for each call.
        const hashedPassword = await enc.hashPassword(password); // Hash the password with scrypt and a random 16-byte salt.

        // Insert the user with the encrypted and original values in parallel.
        // The _plain columns are for academic/demonstration purposes.
        await db.pool.query(
            `INSERT INTO users (username, username_plain, email, password, password_plain) VALUES ($1, $2, $3, $4, $5)`, [encryptedUsername, username, email, hashedPassword, password]
        );

        res.status(200).send({ message: "Successfully Registered" });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

module.exports = { logIn, register };