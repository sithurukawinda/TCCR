import { JoinRequest } from '../../../src/domain/entities/JoinRequest';

const make = (status: 'pending' | 'approved' | 'rejected' = 'pending'): JoinRequest =>
  new JoinRequest({
    id: 'req-1', cellId: 'cell-1', requesterUid: 'uid-1',
    message: null, status, decidedByUid: null, decisionNote: null,
    createdAt: '2026-01-01T00:00:00Z', decidedAt: null,
  });

describe('JoinRequest entity', () => {
  describe('approve()', () => {
    it('transitions pending → approved', () => {
      const r = make('pending');
      r.approve('admin-uid', 'Welcome!');
      expect(r.status).toBe('approved');
      expect(r.decidedByUid).toBe('admin-uid');
      expect(r.decisionNote).toBe('Welcome!');
      expect(r.decidedAt).not.toBeNull();
    });
    it('throws 409 when already decided', () => {
      expect(() => make('approved').approve('admin')).toThrow(
        expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }),
      );
    });
  });

  describe('reject()', () => {
    it('transitions pending → rejected', () => {
      const r = make('pending');
      r.reject('admin-uid', 'Cell full');
      expect(r.status).toBe('rejected');
      expect(r.decisionNote).toBe('Cell full');
    });
    it('throws 409 when already decided', () => {
      expect(() => make('rejected').reject('admin')).toThrow(
        expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }),
      );
    });
  });
});
