"use strict";

require("dotenv").config();

const express = require("express");
const router = require("./routes/auth.route.js");
const corsMiddleware = require("./middlewares/cors-middleware.js");
const {initSchema, checkConnection} = require("./models/db.model.js");
const {errorHandler, notFound} = require("./middlewares/error-handler.js");
const app = express();
const PORT = process.env.PORT || 3000;

// Midleware globales
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Rutas
app.use("/api", router);

// Menejos de errores
app.use(notFound);
app.use(errorHandler);

// Arranque del servidor
async function start() {
    try {
        // Verificar conexión
        const db = await checkConnection();
        if (!db.ok) {
            console.error("No se pudo conectar a PostgreSQL:", db.message);
            console.error("Verifica tu archivo .env y que PostgreSQl esté corriendo");
            process.exit(1);
        }
        console.log("[DB] ", db.message);
        
        //Craer tabla si no existe
        await initSchema();

        app.listen(PORT, () => {
            console.log(`[SERVER] Data Poison AI API corriendo en http://localhost:${PORT}`);
            console.log(`[HEALTH] http://localhost:${PORT}/api/`);
            console.log(`[AUTH] POST http://localhost:${PORT}/api/login`);
            console.log(`[AUTH] POST http://localhost:${PORT}/api/register`);
        });
    } catch (err) {
        console.error("[FATAL] Error al iniciar el servidor", err.message);
        process.exit(1);
    }
}

start();