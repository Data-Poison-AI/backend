const crypto = require("crypto");

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;
const SEPARATOR = ":";

/**
 * Hash.
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
 * Verify against stored hash.
 */
async function verifyPassword(plainPassword, storedHash) {
    return new Promise((resolve, reject) => {
        const [saltHex, hashHex] = storedHash.split(SEPARATOR);
        if (!saltHex || !hashHex) return reject(new Error("Invalid password hash"));

        const salt = Buffer.from(saltHex, "hex");
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

module.exports = {
    hashPassword,
    verifyPassword,
};