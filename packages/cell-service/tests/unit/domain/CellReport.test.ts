import { CellReport } from '../../../src/domain/entities/CellReport';

const make = (voided = false): CellReport =>
  new CellReport({
    id: 'rep-1', cellId: 'cell-1', filledByUid: 'leader-1', clientReqId: 'key-1',
    date: '2026-05-17', didMeet: true, leaderPresent: true,
    location: 'Hall', timeStarted: '2026-05-17T18:00:00Z', timeEnded: '2026-05-17T19:00:00Z',
    language: 'en', subjectDiscussed: 'sunday_sermon', cellType: 'g12', g12LeaderUid: 'g12-1',
    attendance: [], contactedAbsentees: 'no' as const, additionalVisitors: 0, childrenCount: 0,
    satisfactionRate: 4, photoUrls: [], voided, createdAt: '2026-05-17T19:00:00Z',
  });

describe('CellReport entity', () => {
  describe('void()', () => {
    it('sets voided to true and stores reason', () => {
      const r = make(false);
      r.void('Wrong date entered.');
      expect(r.voided).toBe(true);
      expect(r.additionalInfo).toBe('Wrong date entered.');
    });

    it('throws 409 REPORT_ALREADY_VOIDED when already voided', () => {
      expect(() => make(true).void('reason')).toThrow(
        expect.objectContaining({ status: 409, errorCode: 'REPORT_ALREADY_VOIDED' }),
      );
    });
  });
});
