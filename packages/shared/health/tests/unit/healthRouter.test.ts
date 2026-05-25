import { Request, Response } from 'express';

// ── Mock Firestore ────────────────────────────────────────────────────────────
const mockGet = jest.fn();
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { healthRouter } from '../../src/healthRouter';

function getHandler(method: 'get', path: string) {
  const layer = (healthRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method],
  );
  return layer?.route?.stack[0]?.handle as
    | ((req: Request, res: Response) => void | Promise<void>)
    | undefined;
}

function makeRes() {
  const res: any = {};
  res.json   = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res as Response & { json: jest.Mock; status: jest.Mock };
}

const req = {} as Request;

describe('GET /healthz', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SERVICE_NAME = 'test-service';
  });

  it('returns { status: ok, service } with 200', () => {
    const handler = getHandler('get', '/healthz');
    expect(handler).toBeDefined();

    const res = makeRes();
    handler!(req, res);

    expect(res.json).toHaveBeenCalledWith({
      status:  'ok',
      service: 'test-service',
    });
  });
});

describe('GET /readyz', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns { status: ready } when Firestore is reachable', async () => {
    mockGet.mockResolvedValue({});
    const handler = getHandler('get', '/readyz');
    const res     = makeRes();

    await handler!(req, res);

    expect(res.json).toHaveBeenCalledWith({ status: 'ready' });
  });

  it('returns 503 { status: not_ready } when Firestore throws', async () => {
    mockGet.mockRejectedValue(new Error('connection refused'));
    const handler = getHandler('get', '/readyz');
    const res     = makeRes();

    await handler!(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      status: 'not_ready',
      error:  'Firestore unreachable',
    });
  });
});
