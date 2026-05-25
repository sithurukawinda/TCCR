import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const generalLimiter = rateLimit({
  windowMs:        config.rateLimitWindowMs,
  max:             config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.' } },
});

export const authLimiter = rateLimit({
  windowMs:        config.rateLimitWindowMs,
  max:             config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: { code: 'AUTH_RATE_LIMIT_EXCEEDED', message: 'Too many auth attempts.' } },
});
