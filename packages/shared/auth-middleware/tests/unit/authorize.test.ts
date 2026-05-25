import { Request, Response, NextFunction } from 'express';
import { authorize, AuthenticatedRequest, Principal } from '../../src/index';

jest.mock('@shared/errors', () => ({
  createHttpError: (status: number, code: string, message: string) => {
    const err: any = new Error(message);
    err.status    = status;
    err.errorCode = code;
    return err;
  },
}));

function makeReq(principal?: Principal): Request {
  const req = {} as AuthenticatedRequest;
  if (principal) req.principal = principal;
  return req as unknown as Request;
}

const res  = {} as Response;
const next = jest.fn() as unknown as NextFunction;

describe('authorize()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls next() when role matches', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'student', roles: ['student'] });
    authorize('student')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(403 FORBIDDEN) when role does not match', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'student', roles: ['student'] });
    authorize('admin')(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, errorCode: 'FORBIDDEN' }),
    );
  });

  it('super_admin passes an admin-only route', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'super_admin', roles: ['super_admin'] });
    authorize('admin')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('super_admin passes a super_admin-only route', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'super_admin', roles: ['super_admin'] });
    authorize('super_admin')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('admin does NOT pass a super_admin-only route', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'admin', roles: ['admin'] });
    authorize('super_admin')(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, errorCode: 'FORBIDDEN' }),
    );
  });

  it('student does NOT pass an admin route', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'student', roles: ['student'] });
    authorize('admin')(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, errorCode: 'FORBIDDEN' }),
    );
  });

  it('accepts multiple allowed roles', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'admin', roles: ['admin'] });
    authorize('student', 'admin')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('promoted admin passes both student and admin routes', () => {
    const req = makeReq({ uid: 'u1', email: 'e@e.com', role: 'admin', roles: ['student', 'admin'] });
    authorize('student')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(401 UNAUTHENTICATED) when principal is missing', () => {
    const req = makeReq(); // no principal
    authorize('student')(req, res, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, errorCode: 'UNAUTHENTICATED' }),
    );
  });
});
