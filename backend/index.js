require("dotenv").config();

const express = require("express");
const routerAuth = require("./routes/auth.route.js");
const routerUploads = require("./routes/uploads.route.js");
const corsMiddleware = require("./middlewares/cors-middleware.js");
const { initSchema, checkConnection } = require("./models/db.model.js");
const { errorHandler, notFound } = require("./middlewares/error-handler.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(corsMiddleware);
app.use(express.json());

app.use("/api/auth", routerAuth);
app.use("/api/uploads", routerUploads);

app.use(notFound);
app.use(errorHandler);

async function start() {
    try {
        const db = await checkConnection();
        if (!db.ok) {
            console.error("No se pudo conectar a PostgreSQL:", db.message);
            process.exit(1);
        }
        console.log("Database: ", db.message);

        // Initialize database schema
        await initSchema();

        app.listen(PORT, () => {
            console.log(`[SERVER] Data Poison AI API corriendo en http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Error al iniciar el servidor", err.message);
        process.exit(1);
    }
}

start();