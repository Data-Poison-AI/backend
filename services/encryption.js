// Centralized encryption service for sensitive data.
"use strict";  // Enable strict mode: prevents silent errors and the use of undeclared variables.

// Use only the built-in `crypto` module of Node.js, without external dependencies.
require("dotenv").config();
const crypto = require("crypto");

// Configuration constants
const SCRYPT_KEYLEN   = 64; // Length of the resulting hash in bytes (512 bits).
const SCRYPT_SALT_LEN = 16; // Length of the random salt in bytes (128 bits).
const AES_IV_LEN      = 12; // Length of the IV for AES-GCM in bytes (96 bits, NIST standard).
const AES_TAG_LEN     = 16; // Length of the GCM authentication tag in bytes (128 bits).
const SEPARATOR       = ":"; // Separator between the parts of the string stored in the database.

// AES encryption key

/**
 * Reads and validates the AES key from the ENCRYPTION_KEY environment variable.
 * The key must have exactly 64 hexadecimal characters (32 bytes = 256 bits).
 * @returns {Buffer} AES key ready for use with crypto.
 * @throws {Error} If the key does not exist or has the incorrect length.
 */
function getEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error(
            "[encryption.service] ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales (32 bytes). " +
            "Genera una con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }
    // Convert the hex string to a binary buffer to use as an AES key.
    return Buffer.from(keyHex, "hex");
}

// PASSWORDS — One-way hash with scrypt.

/**
 * Generates a secure password hash using scrypt.
 * Each call produces a different result thanks to the random salt.
 * @param {string} plainPassword - Password in plain text.
 * @returns {Promise<string>} Hash in “salt:hash” format ready to be stored in the database.
 */
async function hashPassword(plainPassword) {
    return new Promise((resolve, reject) => {
        // Unique random salt for each password: protects against rainbow table attacks.
        const salt = crypto.randomBytes(SCRYPT_SALT_LEN);
        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, hash) => {
            if (err) return reject(err);
            // Store salt and hash together so they can be verified later.
            resolve(`${salt.toString("hex")}${SEPARATOR}${hash.toString("hex")}`);
        });
    });
}

/**
 * Checks if a plaintext password matches the stored hash.
 * @param {string} plainPassword - Password entered by the user.
 * @param {string} storedHash    - Hash in “salt:hash” format retrieved from the database.
 * @returns {Promise<boolean>} true if the password is correct, false if not.
 */
async function verifyPassword(plainPassword, storedHash) {
    return new Promise((resolve, reject) => {
        // Separate the salt from the hash so that you can rehash with the same salt.
        const [saltHex, hashHex] = storedHash.split(SEPARATOR);
        if (!saltHex || !hashHex) return reject(new Error("Hash de contraseña inválido"));

        const salt         = Buffer.from(saltHex, "hex");
        const expectedHash = Buffer.from(hashHex, "hex");

        // Rehashe the entered password with the same salt for comparison.
        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, derivedHash) => {
            if (err) return reject(err);
            // timingSafeEqual compares in constant time to prevent timing attacks.
            try {
                resolve(crypto.timingSafeEqual(derivedHash, expectedHash));
            } catch {
                resolve(false);
            }
        });
    });
}

// USERNAMES — Reversible symmetric encryption with AES-256-GCM

/**
 * Encrypts a username with AES-256-GCM.
 * GCM (Galois/Counter Mode) guarantees both confidentiality and integrity
 * through the authentication tag — detects if the data has been tampered with.
 * @param {string} plainUsername - Username in plain text.
 * @returns {string} Encrypted text in “iv:tag:ciphertext” format for storage in the database.
 */
function encryptUsername(plainUsername) {
    const key    = getEncryptionKey();
    const iv     = crypto.randomBytes(AES_IV_LEN); // Ensures that two encryptions of the same text produce different results.
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    // Encrypts plain text and obtains the ciphertext in hexadecimal.
    let ciphertext = cipher.update(plainUsername, "utf8", "hex");
    ciphertext    += cipher.final("hex");
    const tag      = cipher.getAuthTag(); // The authentication tag allows you to verify that the data was not altered during decryption.

    // Store IV + tag + ciphertext together so that it can be decrypted later.
    return `${iv.toString("hex")}${SEPARATOR}${tag.toString("hex")}${SEPARATOR}${ciphertext}`;
}

/**
 * Decrypts a username encrypted with AES-256-GCM.
 * Requires the correct ENCRYPTION_KEY — restricted access to the server.
 * If the key is incorrect or the data has been tampered with, it throws an error.
 * @param {string} encryptedUsername - Encrypted text in “iv:tag:ciphertext” format.
 * @returns {string} Username in plain text.
 */
function decryptUsername(encryptedUsername) {
    const key   = getEncryptionKey();
    const parts = encryptedUsername.split(SEPARATOR);

    if (parts.length !== 3) {
        throw new Error("Formato de username cifrado inválido");
    }

    const [ivHex, tagHex, ciphertext] = parts;
    const iv       = Buffer.from(ivHex,  "hex");
    const tag      = Buffer.from(tagHex, "hex");

    if (tag.length !== AES_TAG_LEN) {
        throw new Error("Authentication tag inválido");
    }

    // Provides the tag for GCM to verify integrity before decrypting.
    // If the data has been altered or the key is incorrect, it automatically throws an error.
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let decrypted  = decipher.update(ciphertext, "hex", "utf8");
    decrypted     += decipher.final("utf8");

    return decrypted;
}

/**
 * Decrypts the username from an array of database rows.
 * Used to prepare the response to the frontend after login.
 * @param {Array} rows - Database rows with the encrypted `username` field.
 * @returns {Array} Rows with the decrypted `username` field.
 */
function decryptUserRows(rows) {
    return rows.map(row => {
        try {
            // Replace the encrypted username with plain text in each row.
            return { ...row, username: decryptUsername(row.username) };
        } catch (err) {
            // If decryption fails (incorrect key, corrupted data),
            // do not expose the encrypted value: return a secure placeholder.
            return { ...row, username: "[protected]" };
        }
    });
}

module.exports = {hashPassword, verifyPassword, encryptUsername, decryptUsername, decryptUserRows, };