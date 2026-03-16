// CORS middleware to control allowed origins for backend requests.
require("dotenv").config();

// Allowed origins - covers local dev, docker setup, and production via env vars
const ALLOWED_ORIGINS = [
    "http://localhost",           // Frontend via Nginx (port 80, default)
    "http://localhost:80",        // Frontend via Nginx (explicit port 80)
    "http://localhost:3000",      // Direct backend access (dev)
    "http://localhost:8080",      // Alternative dev port
    "http://127.0.0.1",          // Loopback
    "http://127.0.0.1:80",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
    "null",                       // Local file access (some browsers send "null")
];

// Dynamically add env-provided URLs (for production server deployment)
if (process.env.FRONTEND_URL) {
    ALLOWED_ORIGINS.push(process.env.FRONTEND_URL);
}
if (process.env.SERVER_URL) {
    ALLOWED_ORIGINS.push(process.env.SERVER_URL);
}

/**
 * Custom CORS middleware to handle headers and preflight OPTIONS requests.
 */
function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    // Allow the origin if it's in the whitelist, or allow all if no origin (server-to-server)
    if (!origin) {
        res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
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