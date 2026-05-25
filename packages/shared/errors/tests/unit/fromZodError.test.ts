import { z } from 'zod';
import { fromZodError } from '../../src/fromZodError';
import { AppError } from '../../src/AppError';

const schema = z.object({
  email:     z.string().email('Enter a valid email address'),
  firstName: z.string().min(1, 'First name is required'),
  password:  z.string().min(10, 'Password must be at least 10 characters'),
});

describe('fromZodError', () => {
  it('returns an AppError with status 400 and VALIDATION_ERROR code', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    const err = fromZodError(result.error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Request validation failed.');
  });

  it('maps field paths to error message arrays in details', () => {
    const result = schema.safeParse({ email: 'not-an-email', firstName: '', password: 'short' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const err = fromZodError(result.error);
    expect(err.details).toBeDefined();
    expect(err.details!['email']).toContain('Enter a valid email address');
    expect(err.details!['firstName']).toContain('First name is required');
    expect(err.details!['password']).toContain('Password must be at least 10 characters');
  });

  it('accumulates multiple errors for the same field', () => {
    const multiSchema = z.object({
      age: z.number().min(0).max(120),
    });

    const result = multiSchema.safeParse({ age: -5 });
    expect(result.success).toBe(false);
    if (result.success) return;

    const err = fromZodError(result.error);
    expect(err.details!['age']).toBeDefined();
    expect(err.details!['age'].length).toBeGreaterThanOrEqual(1);
  });

  it('uses _root key for top-level validation errors', () => {
    const rootSchema = z.string().min(1);
    const result = rootSchema.safeParse('');
    expect(result.success).toBe(false);
    if (result.success) return;

    const err = fromZodError(result.error);
    expect(err.details!['_root']).toBeDefined();
  });
});
