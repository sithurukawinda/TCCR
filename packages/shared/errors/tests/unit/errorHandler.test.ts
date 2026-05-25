import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/errorHandler';
import { AppError } from '../../src/AppError';

jest.mock('@shared/logger', () => ({
  logger: { error: jest.fn() },
}));

function makeRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json, _json: json } as unknown as Response & {
    status: jest.Mock;
    _json: jest.Mock;
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'x-request-id': 'test-request-id' },
    method:  'GET',
    url:     '/api/v1/test',
    ...overrides,
  } as unknown as Request;
}

const next = jest.fn() as unknown as NextFunction;

describe('errorHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the AppError status and errorCode for 4xx errors', () => {
    const res = makeRes();
    const err = new AppError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.error.code).toBe('COURSE_NOT_FOUND');
    expect(body.error.message).toBe('Course not found.');
    expect(body.requestId).toBe('test-request-id');
  });

  it('returns generic message for 5xx errors — never exposes real message', () => {
    const res = makeRes();
    const err = new AppError(500, 'INTERNAL_ERROR', 'Raw DB error details');

    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.error.message).toBe('An internal error occurred. Please try again.');
    expect(body.error.message).not.toContain('Raw DB error details');
  });

  it('includes details only on 400 responses', () => {
    const res = makeRes();
    const details = { email: ['Enter a valid email address'] };
    const err = new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', details);

    errorHandler(err, makeReq(), res, next);

    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.error.details).toEqual(details);
  });

  it('omits details on non-400 errors', () => {
    const res = makeRes();
    const err = new AppError(409, 'EMAIL_EXISTS', 'Email already registered.');

    errorHandler(err, makeReq(), res, next);

    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.error.details).toBeUndefined();
  });

  it('defaults to 500 for non-AppError exceptions', () => {
    const res = makeRes();
    const err = new Error('Unexpected failure');

    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An internal error occurred. Please try again.');
  });

  it('uses unknown as requestId when header is absent', () => {
    const res = makeRes();
    const err = new AppError(400, 'BAD', 'Bad.');
    const req = makeReq({ headers: {} });

    errorHandler(err, req, res, next);

    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.requestId).toBe('unknown');
  });
});
