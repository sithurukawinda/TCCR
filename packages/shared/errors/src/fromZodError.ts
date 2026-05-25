import { ZodError } from 'zod';
import { AppError } from './AppError';

export function fromZodError(error: ZodError): AppError {
  const details: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const field = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!details[field]) details[field] = [];
    details[field].push(issue.message);
  }

  return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', details);
}
