import { Subject } from '../../../src/domain/entities/Subject';

const make = (): Subject =>
  new Subject({
    id: 'sub-1', semesterId: 'sem-1', courseId: 'c-1',
    title: 'TypeScript Basics', order: 1, deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

describe('Subject entity', () => {
  describe('update()', () => {
    it('updates title', () => {
      const s = make();
      s.update({ title: 'Advanced TypeScript' });
      expect(s.title).toBe('Advanced TypeScript');
    });

    it('updates updatedAt', () => {
      const s = make();
      const before = s.updatedAt;
      s.update({ title: 'X' });
      expect(s.updatedAt).not.toBe(before);
    });

    it('does not change title when not provided', () => {
      const s = make();
      s.update({});
      expect(s.title).toBe('TypeScript Basics');
    });
  });

  describe('softDelete()', () => {
    it('sets deletedAt', () => {
      const s = make();
      s.softDelete();
      expect(s.deletedAt).not.toBeNull();
    });

    it('updates updatedAt', () => {
      const s = make();
      const before = s.updatedAt;
      s.softDelete();
      expect(s.updatedAt).not.toBe(before);
    });
  });
});
