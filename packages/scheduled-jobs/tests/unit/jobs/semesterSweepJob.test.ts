/**
 * Unit tests for semesterSweepJob — mocks Firestore and OutboxEventPublisher
 */

const mockUpdate     = jest.fn();
const mockDocRef     = { update: mockUpdate };
const mockDoc        = jest.fn().mockReturnValue(mockDocRef);

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({
    collection: jest.fn(),
  }),
}));

jest.mock('@shared/events', () => ({
  OutboxEventPublisher: jest.fn().mockImplementation(() => ({
    publishWithBatch: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getFirestore } from 'firebase-admin/firestore';
import { runSemesterSweep } from '../../../src/jobs/semesterSweepJob';

function makeQueryChain(docs: Array<{ id: string; data: () => object }>) {
  const chain: Record<string, jest.Mock> = {};
  chain.where  = jest.fn().mockReturnValue(chain);
  chain.get    = jest.fn().mockResolvedValue({ docs, empty: docs.length === 0 });
  return chain;
}

describe('semesterSweepJob', () => {
  let mockCol: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockCol = jest.fn();
    (getFirestore as jest.Mock).mockReturnValue({ collection: mockCol });
  });

  it('disables active semesters whose endDate has passed', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const chain = makeQueryChain([{
      id: 'sem-1',
      data: () => ({
        courseId: 'c-1', title: 'Semester 1', status: 'active',
        endDate: yesterday, deletedAt: null, updatedAt: '2026-01-01T00:00:00Z',
      }),
    }]);
    mockCol.mockReturnValue({ where: jest.fn().mockReturnValue(chain), doc: mockDoc });

    await runSemesterSweep();

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'disabled' }));
  });

  it('does nothing when no semesters have expired', async () => {
    const emptyChain = makeQueryChain([]);
    mockCol.mockReturnValue({ where: jest.fn().mockReturnValue(emptyChain), doc: mockDoc });

    await runSemesterSweep();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips semesters with null endDate', async () => {
    const chain = makeQueryChain([{
      id: 'sem-noend',
      data: () => ({
        courseId: 'c-1', title: 'No End', status: 'active',
        endDate: null, deletedAt: null, updatedAt: '2026-01-01T00:00:00Z',
      }),
    }]);
    mockCol.mockReturnValue({ where: jest.fn().mockReturnValue(chain), doc: mockDoc });

    await runSemesterSweep();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('processes multiple expired semesters', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const chain = makeQueryChain([
      { id: 'sem-a', data: () => ({ courseId: 'c-1', title: 'A', status: 'active', endDate: yesterday, deletedAt: null, updatedAt: '2026-01-01T00:00:00Z' }) },
      { id: 'sem-b', data: () => ({ courseId: 'c-1', title: 'B', status: 'active', endDate: yesterday, deletedAt: null, updatedAt: '2026-01-01T00:00:00Z' }) },
    ]);
    mockCol.mockReturnValue({ where: jest.fn().mockReturnValue(chain), doc: mockDoc });

    await runSemesterSweep();

    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
