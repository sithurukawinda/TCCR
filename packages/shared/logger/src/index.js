"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
        service: process.env.SERVICE_NAME,
        version: process.env.SERVICE_VERSION,
        env: process.env.NODE_ENV,
    },
    serializers: {
        req: req => ({
            method: req.method,
            url: req.url,
            requestId: req.headers['x-request-id'],
        }),
        err: pino_1.default.stdSerializers.err,
    },
    redact: {
        paths: [
            'req.headers.authorization',
            '*.password',
            '*.token',
            '*.idToken',
            '*.privateKey',
        ],
        censor: '[REDACTED]',
    },
});
exports.httpLogger = (0, pino_http_1.default)({
    logger: exports.logger,
    customLogLevel: (_req, res) => {
        if (res.statusCode >= 500)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
});
//# sourceMappingURL=index.js.map