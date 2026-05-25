"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("@shared/logger");
const AppError_1 = require("./AppError");
function errorHandler(err, req, res, _next) {
    const requestId = req.headers['x-request-id'] ?? 'unknown';
    const appError = err instanceof AppError_1.AppError ? err : null;
    const statusCode = appError?.status ?? err?.statusCode ?? 500;
    logger_1.logger.error({ err, requestId, method: req.method, url: req.url }, 'Request failed');
    res.status(statusCode).json({
        error: {
            code: appError?.errorCode ?? 'INTERNAL_ERROR',
            message: statusCode < 500
                ? err.message
                : 'An internal error occurred. Please try again.',
            details: statusCode === 400 ? appError?.details : undefined,
        },
        requestId,
    });
}
//# sourceMappingURL=errorHandler.js.map