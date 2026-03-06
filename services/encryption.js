require("dotenv").config();
const crypto = require("crypto");

const SCRYPT_KEYLEN   = 64;
const SCRYPT_SALT_LEN = 16;
const AES_IV_LEN      = 12;
const AES_TAG_LEN     = 16;
const SEPARATOR       = ":";

function getEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error(
            "[encryption.service] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)."
        );
    }
    return Buffer.from(keyHex, "hex");
}

/**
 * Hash password using scrypt.
 */
async function hashPassword(plainPassword) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(SCRYPT_SALT_LEN);
        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, hash) => {
            if (err) return reject(err);
            resolve(`${salt.toString("hex")}${SEPARATOR}${hash.toString("hex")}`);
        });
    });
}

/**
 * Verify password against stored hash.
 */
async function verifyPassword(plainPassword, storedHash) {
    return new Promise((resolve, reject) => {
        const [saltHex, hashHex] = storedHash.split(SEPARATOR);
        if (!saltHex || !hashHex) return reject(new Error("Invalid password hash"));

        const salt         = Buffer.from(saltHex, "hex");
        const expectedHash = Buffer.from(hashHex, "hex");

        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, derivedHash) => {
            if (err) return reject(err);
            try {
                resolve(crypto.timingSafeEqual(derivedHash, expectedHash));
            } catch {
                resolve(false);
            }
        });
    });
}

/**
 * Encrypt username with AES-256-GCM.
 */
function encryptUsername(plainUsername) {
    const key    = getEncryptionKey();
    const iv     = crypto.randomBytes(AES_IV_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let ciphertext = cipher.update(plainUsername, "utf8", "hex");
    ciphertext    += cipher.final("hex");
    const tag      = cipher.getAuthTag();

    return `${iv.toString("hex")}${SEPARATOR}${tag.toString("hex")}${SEPARATOR}${ciphertext}`;
}

/**
 * Decrypt username with AES-256-GCM.
 */
function decryptUsername(encryptedUsername) {
    const key   = getEncryptionKey();
    const parts = encryptedUsername.split(SEPARATOR);

    if (parts.length !== 3) {
        throw new Error("Invalid encrypted username format");
    }

    const [ivHex, tagHex, ciphertext] = parts;
    const iv       = Buffer.from(ivHex,  "hex");
    const tag      = Buffer.from(tagHex, "hex");

    if (tag.length !== AES_TAG_LEN) {
        throw new Error("Invalid authentication tag");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let decrypted  = decipher.update(ciphertext, "hex", "utf8");
    decrypted     += decipher.final("utf8");

    return decrypted;
}

/**
 * Decrypt username field in multiple DB rows.
 */
function decryptUserRows(rows) {
    return rows.map(row => {
        try {
            return { ...row, username: decryptUsername(row.username) };
        } catch (err) {
            return { ...row, username: "[protected]" };
        }
    });
}

module.exports = {
    hashPassword,
    verifyPassword,
    encryptUsername,
    decryptUsername,
    decryptUserRows,
};