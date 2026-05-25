import { createLessonSchema, updateLessonSchema } from '../../../src/http/validators/lessonValidator';

describe('createLessonSchema — youtubeVideoId', () => {
  const base = { title: 'Lesson 1' };

  it('extracts video ID from youtube.com/watch URL', () => {
    const result = createLessonSchema.safeParse({
      ...base,
      youtubeVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from youtu.be short URL', () => {
    const result = createLessonSchema.safeParse({
      ...base,
      youtubeVideoId: 'https://youtu.be/dQw4w9WgXcQ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from youtube.com/embed URL', () => {
    const result = createLessonSchema.safeParse({
      ...base,
      youtubeVideoId: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from URL with extra query params', () => {
    const result = createLessonSchema.safeParse({
      ...base,
      youtubeVideoId: 'https://www.youtube.com/watch?t=30&v=dQw4w9WgXcQ&feature=share',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('rejects a non-YouTube URL', () => {
    const result = createLessonSchema.safeParse({
      ...base,
      youtubeVideoId: 'https://vimeo.com/123456789',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toMatch(/YouTube URL/);
  });

  it('rejects a bare video ID string', () => {
    const result = createLessonSchema.safeParse({
      ...base,
      youtubeVideoId: 'dQw4w9WgXcQ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a random string', () => {
    const result = createLessonSchema.safeParse({
      ...base,
      youtubeVideoId: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null and stores null', () => {
    const result = createLessonSchema.safeParse({ ...base, youtubeVideoId: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBeNull();
  });

  it('defaults to null when youtubeVideoId is omitted', () => {
    const result = createLessonSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBeNull();
  });
});

describe('updateLessonSchema — youtubeVideoId', () => {
  it('extracts video ID from youtube.com/watch URL', () => {
    const result = updateLessonSchema.safeParse({
      youtubeVideoId: 'https://www.youtube.com/watch?v=abc12345678',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBe('abc12345678');
  });

  it('accepts null to clear the video', () => {
    const result = updateLessonSchema.safeParse({ youtubeVideoId: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBeNull();
  });

  it('rejects a non-YouTube URL', () => {
    const result = updateLessonSchema.safeParse({
      youtubeVideoId: 'https://vimeo.com/123456789',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toMatch(/YouTube URL/);
  });

  it('passes through when youtubeVideoId is omitted', () => {
    const result = updateLessonSchema.safeParse({ title: 'Updated Title' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeVideoId).toBeUndefined();
  });
});
