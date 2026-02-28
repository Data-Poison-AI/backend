// CORS middleware: controls which origins can make requests to the backend.
"use strict"; // Enable strict mode: prevents silent errors and the use of undeclared variables.

require("dotenv").config();

// List of allowed origins. Only these URLs can make requests to the API.
// Any other origin will receive a CORS error blocked by the browser.
const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL || "http://localhost:5500", // Frontend URL from .env.
    "http://127.0.0.1:5500", // Localhost variant with direct IP (Live Server).
    "http://localhost:3000", // Allow requests from the same server (testing).
    "null", // Allows you to open index.html directly from the file explorer.
];

/**
 * Custom CORS middleware.
 * Runs on every request before reaching the routes.
 * Adds the necessary headers so that the browser allows communication.
 */

function corsMiddleware(req, res, next) {
    const origin = req.headers.origin; // Origin of the request sent by the browser.

    // Only add the origin header if it is on the whitelist.
    // If there is no origin (Postman, curl), allow the request without restrictions.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

    // HTTP methods that the frontend can use against this API.
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    // Headers that the frontend can include in its requests.
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

    // Allow the browser to send cookies or credentials along with the request.
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // OPTIONS requests are "preflight”: the browser sends them first
    // to ask if it can make the actual request. A 204 (no content) response is returned
    // to confirm that the origin is allowed, without executing business logic.
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    // Passes control to the next middleware or route.
    next();
}

module.exports = corsMiddleware;