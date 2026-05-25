import { Lesson } from '../../../src/domain/entities/Lesson';

const make = (): Lesson =>
  new Lesson({
    id: 'les-1', subjectId: 'sub-1', courseId: 'c-1', semesterId: 'sem-1',
    title: 'Intro', description: 'Overview', youtubeVideoId: null,
    attachmentIds: [], order: 1, deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

describe('Lesson entity', () => {
  describe('update()', () => {
    it('updates title', () => {
      const l = make();
      l.update({ title: 'New Title' });
      expect(l.title).toBe('New Title');
    });

    it('updates description', () => {
      const l = make();
      l.update({ description: 'New desc' });
      expect(l.description).toBe('New desc');
    });

    it('updates youtubeVideoId', () => {
      const l = make();
      l.update({ youtubeVideoId: 'abc123xyz01' });
      expect(l.youtubeVideoId).toBe('abc123xyz01');
    });

    it('clears youtubeVideoId when null passed', () => {
      const l = make();
      l.update({ youtubeVideoId: null });
      expect(l.youtubeVideoId).toBeNull();
    });

    it('updates attachmentIds', () => {
      const l = make();
      l.update({ attachmentIds: ['att-1', 'att-2'] });
      expect(l.attachmentIds).toEqual(['att-1', 'att-2']);
    });

    it('updates updatedAt', () => {
      const l = make();
      const before = l.updatedAt;
      l.update({ title: 'X' });
      expect(l.updatedAt).not.toBe(before);
    });

    it('does not change title when not provided', () => {
      const l = make();
      l.update({ description: 'only desc' });
      expect(l.title).toBe('Intro');
    });
  });

  describe('softDelete()', () => {
    it('sets deletedAt', () => {
      const l = make();
      l.softDelete();
      expect(l.deletedAt).not.toBeNull();
    });

    it('updates updatedAt', () => {
      const l = make();
      const before = l.updatedAt;
      l.softDelete();
      expect(l.updatedAt).not.toBe(before);
    });
  });
});
