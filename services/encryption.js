"use strict";

// Cifrado para datos sensibles
require("dotenv").config();
const crypto = require("crypto");
const SCRYPT_KEYLEN    = 64;   // bytes del hash resultante
const SCRYPT_SALT_LEN  = 16;   // bytes del salt aleatorio
const AES_IV_LEN       = 12;   // bytes del IV para GCM (96 bits, recomendado)
const AES_TAG_LEN      = 16;   // bytes del authentication tag de GCM
const SEPARATOR        = ":";  // separador en el string almacenado en BD

// Clave AES
function getEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error(
            "[encryption.service] ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales (32 bytes). " +
            "Genera una con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }
    return Buffer.from(keyHex, "hex");
}

/**
 * Genera un hash seguro de la contraseña usando scrypt.
 * @param {string} plainPassword - Contraseña en texto plano
 * @returns {Promise<string>} Hash en formato "salt:hash" listo para BD
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
 * Verifica si una contraseña en texto plano coincide con el hash almacenado.
 * @param {string} plainPassword - Contraseña ingresada por el usuario
 * @param {string} storedHash - Hash en formato "salt:hash" desde la BD
 * @returns {Promise<boolean>}
 */

async function verifyPassword(plainPassword, storedHash) {
    return new Promise((resolve, reject) => {
        const [saltHex, hashHex] = storedHash.split(SEPARATOR);
        if (!saltHex || !hashHex) return reject(new Error("Hash de contraseña inválido"));

        const salt         = Buffer.from(saltHex, "hex");
        const expectedHash = Buffer.from(hashHex, "hex");

        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, derivedHash) => {
            if (err) return reject(err);
            // timingSafeEqual evita ataques de timing
            try {
                resolve(crypto.timingSafeEqual(derivedHash, expectedHash));
            } catch {
                resolve(false);
            }
        });
    });
}

/**
 * Cifra un username con AES-256-GCM.
 * @param {string} plainUsername - Nombre de usuario en texto plano
 * @returns {string} Texto cifrado en formato "iv:tag:ciphertext" para BD
 */

function encryptUsername(plainUsername) {
    const key    = getEncryptionKey();
    const iv     = crypto.randomBytes(AES_IV_LEN);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let ciphertext = cipher.update(plainUsername, "utf8", "hex");
    ciphertext    += cipher.final("hex");
    const tag      = cipher.getAuthTag(); // authentication tag de GCM

    return `${iv.toString("hex")}${SEPARATOR}${tag.toString("hex")}${SEPARATOR}${ciphertext}`;
}

/**
 * Descifra un username cifrado con AES-256-GCM.
 * Solo funciona si ENCRYPTION_KEY es correcta — acceso restringido al servidor.
 * @param {string} encryptedUsername - Texto cifrado en formato "iv:tag:ciphertext"
 * @returns {string} Nombre de usuario en texto plano
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

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let decrypted  = decipher.update(ciphertext, "hex", "utf8");
    decrypted     += decipher.final("utf8");

    return decrypted;
}

/**
 * Cifra todos los usernames cifrados en un array de rows de la BD
 * y devuelve los rows con los usernames descifrados para la respuesta.
 * @param {Array} rows - Filas de la BD con username cifrado
 * @returns {Array} Filas con username descifrado
 */

function decryptUserRows(rows) {
    return rows.map(row => {
        try {
            return { ...row, username: decryptUsername(row.username) };
        } catch {
            // Si no se puede descifrar, no exponer el valor cifrado
            return { ...row, username: "[protected]" };
        }
    });
}

module.exports = {hashPassword, verifyPassword, encryptUsername, decryptUsername, decryptUserRows, };