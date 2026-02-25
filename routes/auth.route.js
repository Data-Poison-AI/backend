"use strict";

// Endpoint de verificación de la conexión a la base de datos
const router = require("express").Router();
const {checkConnection} = require("../models/db.model.js");
const { logIn, register } = require("../controllers/auth.controller.js");

router.post("/login/", logIn);
router.post("/register/", register);
router.get("/", async (req, res) => {
    const db = await checkConnection();
    const status = db.ok ? 200 : 503;

    res.status(status).json({
        ok: db.ok, service: "Data Poison AI API", database: db.message, timestamp: new Date().toISOString(),
    });
});

module.exports = router;