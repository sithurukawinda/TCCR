import { listCoursesSchema } from '../../../src/http/validators/courseValidator';

describe('listCoursesSchema — title filter', () => {
  it('accepts a valid title string', () => {
    const r = listCoursesSchema.safeParse({ title: 'TypeScript' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe('TypeScript');
  });

  it('accepts title alongside state and limit', () => {
    const r = listCoursesSchema.safeParse({ title: 'Intro', state: 'published', limit: '10' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe('Intro');
      expect(r.data.state).toBe('published');
      expect(r.data.limit).toBe(10);
    }
  });

  it('is optional — omitting title returns undefined', () => {
    const r = listCoursesSchema.safeParse({ limit: '5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBeUndefined();
  });

  it('rejects an empty string', () => {
    const r = listCoursesSchema.safeParse({ title: '' });
    expect(r.success).toBe(false);
  });

  it('rejects a title exceeding 200 characters', () => {
    const r = listCoursesSchema.safeParse({ title: 'A'.repeat(201) });
    expect(r.success).toBe(false);
  });

  it('accepts a title of exactly 200 characters', () => {
    const r = listCoursesSchema.safeParse({ title: 'A'.repeat(200) });
    expect(r.success).toBe(true);
  });
});

describe('listCoursesSchema — state filter', () => {
  it('accepts draft, published, archived', () => {
    for (const state of ['draft', 'published', 'archived'] as const) {
      const r = listCoursesSchema.safeParse({ state });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.state).toBe(state);
    }
  });

  it('rejects an invalid state value', () => {
    const r = listCoursesSchema.safeParse({ state: 'deleted' });
    expect(r.success).toBe(false);
  });

  it('is optional — omitting state returns undefined', () => {
    const r = listCoursesSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.state).toBeUndefined();
  });
});

describe('listCoursesSchema — limit and cursor', () => {
  it('coerces limit from string to number', () => {
    const r = listCoursesSchema.safeParse({ limit: '50' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(50);
  });

  it('defaults limit to 20 when omitted', () => {
    const r = listCoursesSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(20);
  });

  it('rejects limit above 100', () => {
    const r = listCoursesSchema.safeParse({ limit: '101' });
    expect(r.success).toBe(false);
  });

  it('rejects limit of 0', () => {
    const r = listCoursesSchema.safeParse({ limit: '0' });
    expect(r.success).toBe(false);
  });

  it('accepts a cursor string', () => {
    const r = listCoursesSchema.safeParse({ cursor: 'doc-id-xyz' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cursor).toBe('doc-id-xyz');
  });
});
