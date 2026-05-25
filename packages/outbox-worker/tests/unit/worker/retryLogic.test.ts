import { processEvent, OutboxDoc } from '../../../src/outbox/processEvent';
import { EventDispatcher }         from '../../../src/dispatcher/EventDispatcher';

const mockUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({ doc: () => ({ update: mockUpdate }) }),
  }),
}));

jest.mock('@shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const makeDispatcher = (dispatch: jest.Mock): EventDispatcher =>
  ({ dispatch } as unknown as EventDispatcher);

const makeDoc = (attempts = 0): OutboxDoc => ({
  eventType: 'user.registered', payload: {}, requestId: 'req-1',
  status: 'pending', attempts, createdAt: '2026-01-01T00:00:00.000Z',
  processedAt: null, error: null,
});

describe('processEvent retry logic', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('marks delivered on success', async () => {
    const dispatch = jest.fn().mockResolvedValue(undefined);
    await processEvent('id-1', makeDoc(), makeDispatcher(dispatch));

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'processing' });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'delivered' }));
  });

  it('marks pending with incremented attempts on first failure', async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error('timeout'));
    await processEvent('id-1', makeDoc(0), makeDispatcher(dispatch));

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending', attempts: 1 });
  });

  it('marks failed after 5th attempt', async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error('service down'));
    await processEvent('id-1', makeDoc(4), makeDispatcher(dispatch));

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', attempts: 5 }));
  });

  it('never throws — processing continues after per-event failure', async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error('crash'));
    await expect(processEvent('id-1', makeDoc(), makeDispatcher(dispatch))).resolves.toBeUndefined();
  });
});
