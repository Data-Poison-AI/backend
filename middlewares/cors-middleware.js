// Middleware de CORS que permite peticiones desde el frontend
"use strict";

require("dotenv").config();

const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL || "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "null", // Permite abrir index.html desde el sistema de archivos
];

// Middleware express con CORS personalizados.

function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    // Permitir si el origen existe.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Responder a las peticiones
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
}

module.exports = corsMiddleware;