import { fileReportSchema } from '../../../src/http/validators/reportValidator';

const CLIENT_REQ_ID = '014ecc59-3689-4559-9d8a-2eaf5e3a271a';

describe('fileReportSchema — location vs didMeet', () => {
  it('accepts a "did not meet" report with no location', () => {
    const parsed = fileReportSchema.safeParse({
      date:        '2026-06-05',
      didMeet:     false,
      clientReqId: CLIENT_REQ_ID,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.location).toBe('');
  });

  it('accepts a "did meet" report when a location is provided', () => {
    const parsed = fileReportSchema.safeParse({
      date:        '2026-06-05',
      didMeet:     true,
      location:    'Hall A',
      clientReqId: CLIENT_REQ_ID,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects a "did meet" report with an empty/missing location', () => {
    const parsed = fileReportSchema.safeParse({
      date:        '2026-06-05',
      didMeet:     true,
      clientReqId: CLIENT_REQ_ID,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some(i => i.path.includes('location'))).toBe(true);
    }
  });

  it('rejects a "did meet" report when location is only whitespace', () => {
    const parsed = fileReportSchema.safeParse({
      date:        '2026-06-05',
      didMeet:     true,
      location:    '   ',
      clientReqId: CLIENT_REQ_ID,
    });

    expect(parsed.success).toBe(false);
  });
});
