"use strict";  // Enable strict mode: prevents silent errors and the use of undeclared variables.

const router = require("express").Router(); // Express router: groups related routes under the same prefix (/api).
const {checkConnection} = require("../models/db.model.js"); // Function to verify if the database is still active (used in the health check).
const { logIn, register } = require("../controllers/auth.controller.js"); // Authentication controllers: login and registration.

// Authentication paths.
router.post("/login/", logIn); // POST /api/login/ — Log in with email and password.
router.post("/register/", register); // POST /api/register/ — Registers a new user.

// Health check endpoint.
// GET /api/ — Verifies that the server and database are working.
// Useful for monitoring and confirming that the backend is active before using it.
router.get("/", async (req, res) => {
    const db = await checkConnection();
    const status = db.ok ? 200 : 503; // 200 OK if DB responds, 503 if not.

    res.status(status).json({
        ok: db.ok, service: "Data Poison AI API", database: db.message, timestamp: new Date().toISOString(),
    });
});

module.exports = router;