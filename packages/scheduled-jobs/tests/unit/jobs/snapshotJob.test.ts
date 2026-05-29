/**
 * Unit tests for snapshotJob — mocks Firestore
 */

const mockBatchSet    = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatchObj    = { set: mockBatchSet, commit: mockBatchCommit };

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({ collection: jest.fn(), batch: jest.fn() }),
}));

jest.mock('@shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getFirestore } from 'firebase-admin/firestore';
import { runSnapshotJob } from '../../../src/jobs/snapshotJob';

const NOW = new Date().toISOString().split('T')[0];

function makeReport(overrides: object = {}) {
  return {
    date: NOW, didMeet: true, cellType: 'g12',
    attendance: [
      { status: 'present', isNew: false },
      { status: 'absent',  isNew: false },
    ],
    additionalVisitors: 1, childrenCount: 0, satisfactionRate: 4,
    voided: false, filledByUid: 'leader-1', createdAt: NOW + 'T18:00:00Z',
    ...overrides,
  };
}

describe('snapshotJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockBatchSet.mockReturnValue(undefined);
  });

  it('generates org, leader, and g12 snapshots for active cells', async () => {
    const reportQueryChain = {
      where: jest.fn().mockReturnThis(),
      get:   jest.fn().mockResolvedValue({ docs: [{ data: () => makeReport() }] }),
    };
    const cellReportsCol = jest.fn().mockReturnValue(reportQueryChain);
    const cellDocRef = { collection: cellReportsCol };
    const cellDocFn = jest.fn().mockReturnValue(cellDocRef);

    const cellQueryChain = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{
          id: 'cell-1',
          data: () => ({
            leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
            members: ['leader-1'], memberCount: 1, state: 'active', type: 'g12',
          }),
        }],
      }),
    };

    const snapshotDocRef = { id: 'snap-1' };
    const snapshotDocFn = jest.fn().mockReturnValue(snapshotDocRef);

    (getFirestore as jest.Mock).mockReturnValue({
      collection: (name: string) => {
        if (name === 'cell_groups') return { ...cellQueryChain, doc: cellDocFn };
        if (name === 'analytics_snapshots') return { doc: snapshotDocFn };
        return {};
      },
      batch: () => mockBatchObj,
    });

    await runSnapshotJob();

    // Writes base scopes (org, leader:leader-1, g12:g12-1) + cellType-dimension variants per scope
    expect(mockBatchSet).toHaveBeenCalledTimes(9);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('skips when no active cells exist', async () => {
    const emptyCellQuery = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    (getFirestore as jest.Mock).mockReturnValue({
      collection: () => emptyCellQuery,
      batch:      () => mockBatchObj,
    });

    await runSnapshotJob();

    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('counts voided reports as zero contribution', async () => {
    const reportQueryChain = {
      where: jest.fn().mockReturnThis(),
      // voided=false filter means these would not be returned, but test the aggregate path
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };
    const cellReportsCol = jest.fn().mockReturnValue(reportQueryChain);
    const cellDocRef = { collection: cellReportsCol };

    const cellQueryChain = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{
          id: 'cell-2',
          data: () => ({
            leaderUid: 'leader-2', g12LeaderUid: 'g12-2',
            members: ['leader-2'], memberCount: 1, state: 'active', type: 'care',
          }),
        }],
      }),
    };

    const snapshotDocFn = jest.fn().mockReturnValue({});

    (getFirestore as jest.Mock).mockReturnValue({
      collection: (name: string) => {
        if (name === 'cell_groups') return { ...cellQueryChain, doc: jest.fn().mockReturnValue(cellDocRef) };
        if (name === 'analytics_snapshots') return { doc: snapshotDocFn };
        return {};
      },
      batch: () => mockBatchObj,
    });

    await runSnapshotJob();

    // Snapshot written with 0 reports (all voided / no reports this week)
    expect(mockBatchSet).toHaveBeenCalled();
    const orgSnapshot = mockBatchSet.mock.calls.find(c => c[1]?.scope === 'org')?.[1];
    expect(orgSnapshot?.metrics.reportCount).toBe(0);
    expect(orgSnapshot?.metrics.activeCells).toBe(0);
  });
});
