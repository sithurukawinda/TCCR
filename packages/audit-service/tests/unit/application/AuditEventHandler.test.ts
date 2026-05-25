import { AuditEventHandler } from '../../../src/application/handlers/AuditEventHandler';
import { IAuditRepository }  from '../../../src/domain/repositories/IAuditRepository';

const makeRepo = (): jest.Mocked<IAuditRepository> =>
  ({ append: jest.fn().mockResolvedValue('log-id'), findAll: jest.fn() });

describe('AuditEventHandler', () => {
  let repo:    jest.Mocked<IAuditRepository>;
  let handler: AuditEventHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    handler = new AuditEventHandler(repo);
  });

  it('appends with explicit actorUid and targetType overrides', async () => {
    await handler.handle(
      { action: 'registration.approved', actorUid: 'admin-uid', targetType: 'student', targetId: 'uid-1' },
      'req-1',
    );
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'registration.approved', actorUid: 'admin-uid', targetType: 'student', targetId: 'uid-1', requestId: 'req-1',
    }));
  });

  it('falls back to EVENT_META values for user.registered', async () => {
    await handler.handle({ action: 'user.registered', uid: 'u1', email: 'u@x.com' }, 'req-2');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.registered', actorUid: 'u1', actorEmail: 'u@x.com', category: 'auth', targetType: 'user', targetId: 'u1',
    }));
  });

  it('handles admin.created — resolves actor from payload uid/email', async () => {
    await handler.handle({ action: 'admin.created', uid: 'a1', email: 'a@x.com' }, 'req-3');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin.created', category: 'admin', targetType: 'user', actorUid: 'a1',
    }));
  });

  it('handles admin.suspended', async () => {
    await handler.handle({ action: 'admin.suspended', uid: 'a2', email: 'a2@x.com' }, 'req-4');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin.suspended', category: 'admin',
    }));
  });

  it('handles registration.rejected', async () => {
    await handler.handle({ action: 'registration.rejected', studentUid: 's1', email: 's@x.com' }, 'req-5');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'registration.rejected', category: 'registration', targetType: 'registration', targetId: 's1',
    }));
  });

  it('handles enrollment.pending — compound targetId from studentUid + courseId', async () => {
    await handler.handle({ action: 'enrollment.pending', studentUid: 's1', courseId: 'c1' }, 'req-6');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'enrollment.pending', category: 'enrollment', targetId: 's1_c1',
    }));
  });

  it('handles enrollment.approved', async () => {
    await handler.handle({ action: 'enrollment.approved', studentUid: 's1', courseId: 'c1' }, 'req-7');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'enrollment.approved', category: 'enrollment', targetId: 's1_c1',
    }));
  });

  it('handles enrollment.rejected', async () => {
    await handler.handle({ action: 'enrollment.rejected', studentUid: 's2', courseId: 'c2' }, 'req-8');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'enrollment.rejected', category: 'enrollment',
    }));
  });

  it('handles enrollment.withdrawn', async () => {
    await handler.handle({ action: 'enrollment.withdrawn', studentUid: 's3', courseId: 'c3' }, 'req-9');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'enrollment.withdrawn', category: 'enrollment', targetId: 's3_c3',
    }));
  });

  it('handles course.published — null actorUid/actorEmail by design', async () => {
    await handler.handle({ action: 'course.published', courseId: 'course-1' }, 'req-10');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'course.published', category: 'course', targetType: 'course', targetId: 'course-1',
      actorUid: null, actorEmail: null,
    }));
  });

  it('handles progress.subjectCompleted', async () => {
    await handler.handle({ action: 'progress.subjectCompleted', studentUid: 's1', subjectId: 'sub-1' }, 'req-11');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'progress.subjectCompleted', category: 'progress', targetType: 'subject', targetId: 'sub-1',
    }));
  });

  it('handles audit.action with all explicit fields', async () => {
    await handler.handle(
      { action: 'audit.action', actorUid: 'u1', actorEmail: 'u@x.com', category: 'auth',
        targetType: 'user', targetId: 'uid-1', ip: '127.0.0.1' },
      'req-12',
    );
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'audit.action', actorUid: 'u1', category: 'auth', ip: '127.0.0.1',
    }));
  });

  it('handles unknown event type — writes entry with null meta fields', async () => {
    await handler.handle({ action: 'some.unknown.event' }, 'req-13');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'some.unknown.event', actorUid: null, category: null,
    }));
  });

  it('handles enrollment.pending with only studentUid (no courseId) — targetId falls back to studentUid', async () => {
    await handler.handle({ action: 'enrollment.pending', studentUid: 's1' }, 'req-14');
    expect(repo.append).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 's1',
    }));
  });
});
