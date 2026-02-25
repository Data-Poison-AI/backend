// Middleware global de manejo de errores.
"use strict";

// Manejo de errores de express
function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Error intenrno del servidor";

    console.error(`[ERROR] ${req.method} ${req.path}`, err.message);
    
    res.status(status).json({
        ok: false, error: message, ...(process.env.NODE_ENV === "development" && {stack: err.stack}),
    });
}

// Rutas no encontradas (404)
function notFound(req, res) {
    res.status(404).json({
        ok: false, error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    });
}

module.exports = {errorHandler, notFound};