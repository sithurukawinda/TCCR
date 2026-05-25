import { CellGroup } from '../../../src/domain/entities/CellGroup';

const make = (overrides: Partial<ConstructorParameters<typeof CellGroup>[0]> = {}): CellGroup =>
  new CellGroup({
    id: 'c-1', name: 'Test Cell', type: 'g12', area: 'Area',
    leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
    members: ['leader-1'], memberCount: 1, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });

describe('CellGroup entity', () => {
  describe('isOwnedBy()', () => {
    it('returns true for leaderUid', () => {
      expect(make().isOwnedBy('leader-1')).toBe(true);
    });
    it('returns true for g12LeaderUid', () => {
      expect(make().isOwnedBy('g12-1')).toBe(true);
    });
    it('returns false for other UIDs', () => {
      expect(make().isOwnedBy('random-uid')).toBe(false);
    });
  });

  describe('hasMember()', () => {
    it('returns true when UID is in members', () => {
      expect(make().hasMember('leader-1')).toBe(true);
    });
    it('returns false when UID not in members', () => {
      expect(make().hasMember('not-a-member')).toBe(false);
    });
  });

  describe('addMembers()', () => {
    it('adds new members and updates memberCount', () => {
      const cell = make();
      const added = cell.addMembers(['mem-1', 'mem-2']);
      expect(added).toEqual(['mem-1', 'mem-2']);
      expect(cell.memberCount).toBe(3);
    });
    it('skips duplicate UIDs', () => {
      const cell = make();
      const added = cell.addMembers(['leader-1', 'new-mem']);
      expect(added).toEqual(['new-mem']);
      expect(cell.memberCount).toBe(2);
    });
    it('returns empty array when all UIDs already members', () => {
      const cell = make();
      const added = cell.addMembers(['leader-1']);
      expect(added).toHaveLength(0);
    });
  });

  describe('removeMember()', () => {
    it('removes member and decrements memberCount', () => {
      const cell = make({ members: ['leader-1', 'mem-1'], memberCount: 2 });
      cell.removeMember('mem-1');
      expect(cell.members).not.toContain('mem-1');
      expect(cell.memberCount).toBe(1);
    });
    it('throws 404 when member not found', () => {
      expect(() => make().removeMember('not-a-member')).toThrow(
        expect.objectContaining({ status: 404, errorCode: 'MEMBER_NOT_FOUND' }),
      );
    });
  });

  describe('archive()', () => {
    it('sets state to archived', () => {
      const cell = make();
      cell.archive();
      expect(cell.state).toBe('archived');
    });
    it('throws 409 when already archived', () => {
      const cell = make({ state: 'archived' });
      expect(() => cell.archive()).toThrow(
        expect.objectContaining({ status: 409, errorCode: 'INVALID_STATE' }),
      );
    });
  });

  describe('incrementReportCount()', () => {
    it('increments reportCount by 1', () => {
      const cell = make({ reportCount: 5 });
      cell.incrementReportCount();
      expect(cell.reportCount).toBe(6);
    });
  });
});
