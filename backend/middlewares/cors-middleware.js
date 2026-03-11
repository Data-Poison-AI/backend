// CORS middleware to control allowed origins for backend requests.
require("dotenv").config();

const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL || "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "null",
];

/**
 * Custom CORS middleware to handle headers and preflight OPTIONS requests.
 */
function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    // Set Access-Control-Allow-Origin if origin is whitelisted or empty.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Handle browser preflight OPTIONS requests.
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
}

module.exports = corsMiddleware;