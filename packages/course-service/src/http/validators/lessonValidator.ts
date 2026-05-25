import { z } from 'zod';

// Accepts full YouTube URLs and extracts the 11-char video ID.
// Supported formats:
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://youtu.be/VIDEO_ID
//   https://www.youtube.com/embed/VIDEO_ID
function extractYouTubeId(input: string): string | null {
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

const youtubeUrlField = z
  .string()
  .transform((val, ctx) => {
    const id = extractYouTubeId(val);
    if (!id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Must be a valid YouTube URL (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)',
      });
      return z.NEVER;
    }
    return id;
  })
  .nullable()
  .optional();

export const createLessonSchema = z.object({
  title:          z.string().min(1).max(200),
  description:    z.string().max(2000).default(''),
  youtubeVideoId: youtubeUrlField.default(null),
  attachmentIds:  z.array(z.string()).optional().default([]),
});

export const updateLessonSchema = z.object({
  title:          z.string().min(1).max(200).optional(),
  description:    z.string().min(1).max(2000).optional(),
  youtubeVideoId: youtubeUrlField,
  attachmentIds:  z.array(z.string()).optional(),
});
