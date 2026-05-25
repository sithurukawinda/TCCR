/**
 * Unit tests for batchSweepJob — mocks Firestore and OutboxEventPublisher
 */

const mockUpdate     = jest.fn();
const mockDocRef     = { update: mockUpdate };
const mockDoc        = jest.fn().mockReturnValue(mockDocRef);
const mockCollection = jest.fn();

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({
    collection: mockCollection,
  }),
  FieldValue: { serverTimestamp: jest.fn() },
}));

jest.mock('@shared/events', () => ({
  OutboxEventPublisher: jest.fn().mockImplementation(() => ({
    publishWithBatch: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { runBatchSweep } from '../../../src/jobs/batchSweepJob';

function makeQueryChain(docs: Array<{ id: string; data: () => object }>) {
  const chain: Record<string, jest.Mock> = {};
  chain.where  = jest.fn().mockReturnValue(chain);
  chain.get    = jest.fn().mockResolvedValue({ docs, empty: docs.length === 0 });
  return chain;
}

describe('batchSweepJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockDoc.mockReturnValue(mockDocRef);
  });

  it('opens DRAFT batches whose scheduledOpenAt has passed', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const chain = makeQueryChain([{
      id: 'batch-1',
      data: () => ({ courseId: 'c-1', name: 'Test', state: 'draft', scheduledOpenAt: past, intakeStart: '2026-01-01', intakeEnd: '2026-12-31' }),
    }]);
    const emptyChain = makeQueryChain([]);

    let callCount = 0;
    mockCollection.mockImplementation(() => ({
      where: (field: string) => {
        if (field === 'state' && callCount === 0) { callCount++; return chain; }
        return emptyChain;
      },
      doc: mockDoc,
    }));

    await runBatchSweep();

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ state: 'open' }));
  });

  it('closes OPEN batches whose intakeEnd has passed', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const emptyChain = makeQueryChain([]);
    const closeChain = makeQueryChain([{
      id: 'batch-2',
      data: () => ({ courseId: 'c-1', name: 'Test', state: 'open', scheduledOpenAt: null, intakeStart: '2026-01-01', intakeEnd: yesterday }),
    }]);

    let callCount = 0;
    mockCollection.mockImplementation(() => ({
      where: (field: string, op: string, _val: unknown) => {
        if (field === 'state' && op === '==' && callCount === 0) { callCount++; return emptyChain; }
        if (field === 'state' && op === '==' && callCount === 1) { callCount++; return closeChain; }
        return emptyChain;
      },
      doc: mockDoc,
    }));

    await runBatchSweep();

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ state: 'closed' }));
  });

  it('does nothing when no batches need transition', async () => {
    const emptyChain = makeQueryChain([]);
    mockCollection.mockReturnValue({
      where: jest.fn().mockReturnValue(emptyChain),
      doc:   mockDoc,
    });

    await runBatchSweep();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips drafts with null scheduledOpenAt even if query returns them', async () => {
    const chain = makeQueryChain([{
      id: 'batch-null',
      data: () => ({ courseId: 'c-1', state: 'draft', scheduledOpenAt: null, intakeStart: '2026-01-01', intakeEnd: '2026-12-31' }),
    }]);
    const emptyChain = makeQueryChain([]);

    let callCount = 0;
    mockCollection.mockImplementation(() => ({
      where: (_f: string) => callCount++ === 0 ? chain : emptyChain,
      doc:   mockDoc,
    }));

    await runBatchSweep();

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
