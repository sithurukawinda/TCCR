import { AppError, createHttpError } from '../../src/AppError';

describe('AppError', () => {
  it('sets all properties correctly', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Resource not found.');
    expect(err.status).toBe(404);
    expect(err.errorCode).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found.');
    expect(err.details).toBeUndefined();
    expect(err.name).toBe('AppError');
  });

  it('sets field-level details when provided', () => {
    const details = { email: ['Enter a valid email address'] };
    const err = new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', details);
    expect(err.details).toEqual(details);
  });

  it('is an instance of Error', () => {
    const err = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong.');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('captures a stack trace', () => {
    const err = new AppError(400, 'BAD_REQUEST', 'Bad input.');
    expect(err.stack).toBeDefined();
  });
});

describe('createHttpError', () => {
  it('returns an AppError with correct properties', () => {
    const err = createHttpError(409, 'EMAIL_EXISTS', 'Email already registered.');
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
    expect(err.errorCode).toBe('EMAIL_EXISTS');
    expect(err.message).toBe('Email already registered.');
  });

  it('passes details through correctly', () => {
    const details = { password: ['Must include at least one uppercase letter'] };
    const err = createHttpError(400, 'VALIDATION_ERROR', 'Failed.', details);
    expect(err.details).toEqual(details);
  });
});
