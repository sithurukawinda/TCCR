"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromZodError = fromZodError;
const AppError_1 = require("./AppError");
function fromZodError(error) {
    const details = {};
    for (const issue of error.errors) {
        const field = issue.path.length > 0 ? issue.path.join('.') : '_root';
        if (!details[field])
            details[field] = [];
        details[field].push(issue.message);
    }
    return new AppError_1.AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', details);
}
//# sourceMappingURL=fromZodError.js.map