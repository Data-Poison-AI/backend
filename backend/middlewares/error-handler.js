/**
 * Global error handler: captures errors thrown with next(err) in any route.
 */
function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal server error";

    console.error(`[ERROR] ${req.method} ${req.path}`, err.message);

    res.status(status).json({
        ok: false,
        error: message
    });
}

/**
 * 404 handler: captures requests for non-existent routes.
 */
function notFound(req, res) {
    res.status(404).json({
        ok: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
}

module.exports = { errorHandler, notFound };