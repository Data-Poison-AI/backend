"use strict";  // Enable strict mode: prevents silent errors and the use of undeclared variables.

// Load the variables from the .env file into process.env before anything else.
require("dotenv").config();

const express = require("express");
const router = require("./routes/auth.route.js"); // Main router with all authentication routes (/login, /register, /health).
const corsMiddleware = require("./middlewares/cors-middleware.js"); // Middleware that manages cross-origin permissions (CORS).
const {initSchema, checkConnection} = require("./models/db.model.js"); // Model functions: verify connection and create table if it does not exist.
const {errorHandler, notFound} = require("./middlewares/error-handler.js"); // Middleware for handling global errors and routes not found (404).
const app = express();
const PORT = process.env.PORT || 3000; // Port from .env, with 3000 as fallback.

// Global middleware.
app.use(corsMiddleware); // Global middleware // Apply CORS before any route so that all requests comply with it.
app.use(express.json()); // Allows request bodies to be received in JSON format.
app.use(express.urlencoded({extended: true})); // Allows you to receive data from URL-encoded HTML forms.

// Routes.
app.use("/api", router); // All system routes are exposed under the /api prefix.

// Error handling (always at the end, after routes)
app.use(notFound); // Captures requests to routes that do not exist and responds with 404.
app.use(errorHandler); // Captures any errors thrown within the routes and responds with structured JSON.

// Server startup.
async function start() {
    try {
        // Verify that PostgreSQL is available before accepting traffic.
        const db = await checkConnection();
        if (!db.ok) {
            console.error("No se pudo conectar a PostgreSQL:", db.message);
            console.error("Verifica tu archivo .env y que PostgreSQl esté corriendo");
            process.exit(1); // Terminate the process if the database does not respond.
        }
        console.log("[DB] ", db.message);
        
        // Create the `users` table in the database if it does not already exist.
        await initSchema();

        // The server only starts listening for requests if the database is ready.
        app.listen(PORT, () => {
            console.log(`[SERVER] Data Poison AI API corriendo en http://localhost:${PORT}`);
            console.log(`[HEALTH] http://localhost:${PORT}/api/`);
            console.log(`[AUTH] POST http://localhost:${PORT}/api/login`);
            console.log(`[AUTH] POST http://localhost:${PORT}/api/register`);
        });
    } catch (err) {
        // Unexpected error during startup: the process is logged and terminated.
        console.error("[FATAL] Error al iniciar el servidor", err.message);
        process.exit(1);
    }
}

start();