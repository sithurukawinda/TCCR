"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.createHttpError = createHttpError;
class AppError extends Error {
    status;
    errorCode;
    details;
    constructor(status, errorCode, message, details) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.errorCode = errorCode;
        this.details = details;
        Error.captureStackTrace(this, AppError);
    }
}
exports.AppError = AppError;
function createHttpError(status, errorCode, message, details) {
    return new AppError(status, errorCode, message, details);
}
//# sourceMappingURL=AppError.js.map