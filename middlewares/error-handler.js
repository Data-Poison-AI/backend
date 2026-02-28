// Middleware global de manejo de errores.
"use strict"; // Enable strict mode: prevents silent errors and the use of undeclared variables.

/** Error handling middleware for Express.js.
 * Captures errors thrown with next(err) within any route or middleware.
 * Express identifies it as error middleware because it has exactly 4 parameters.
 * @param {Error} err  - The captured error.
 * @param {object} req - The original HTTP request.
 * @param {object} res - The HTTP response.
 * @param {function} next - Next middleware (required by Express even if not used).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
    // Use the error status code if it exists; otherwise, return 500 by default.
    const status  = err.status || err.statusCode || 500;
    const message = err.message || "Internal server error";

    // Log the error to the console for server debugging.
    console.error(`[ERROR] ${req.method} ${req.path}`, err.message);

    // In development mode, include the stack trace to facilitate debugging.
    // In production, only the message is sent so as not to expose internal information.
    res.status(status).json({
        ok:    false,
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}

/** Not found middleware for Express.js.
 * Captures requests to routes that do not exist on the server.
 * Registered just before errorHandler in index.js.
 * @param {object} req - The HTTP request with the requested route.
 * @param {object} res - The HTTP response.
 */
function notFound(req, res) {
    res.status(404).json({
        ok:    false,
        error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
}

module.exports = {errorHandler, notFound};