import { AdminCreatedHandler }    from '../../../src/application/handlers/AdminCreatedHandler';
import { NotificationDispatcher } from '../../../src/application/services/NotificationDispatcher';

const makeDispatcher = (): jest.Mocked<NotificationDispatcher> =>
  ({ dispatchEmail: jest.fn(), dispatchPush: jest.fn() } as unknown as jest.Mocked<NotificationDispatcher>);

describe('AdminCreatedHandler', () => {
  let dispatcher: jest.Mocked<NotificationDispatcher>;
  let handler:    AdminCreatedHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatcher = makeDispatcher();
    handler    = new AdminCreatedHandler(dispatcher);
  });

  // ── Promotion ─────────────────────────────────────────────────────
  describe('promoted=true', () => {
    it('sends promotion email with promoted subject', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-1', email: 'u@example.com', firstName: 'Alice', lastName: 'Smith', promoted: true },
        'req-1',
      );
      expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
        'u@example.com',
        expect.stringContaining('promoted to Admin'),
        expect.stringContaining('promoted'),
        'req-1',
      );
    });

    it('includes systemUrl link when provided', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-1', email: 'u@example.com', firstName: 'Alice', lastName: 'Smith',
          promoted: true, systemUrl: 'https://tccr.lk' },
        'req-1',
      );
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).toContain('https://tccr.lk');
    });
  });

  // ── Leader account ────────────────────────────────────────────────
  describe('role=leader (new account)', () => {
    it('sends Cell Leader creation email with credentials', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-2', email: 'leader@tccr.lk', firstName: 'Saman', lastName: 'Silva',
          initialPassword: 'Leader@12345', role: 'leader',
          passwordResetUrl: 'https://reset.link/abc', systemUrl: 'https://tccr.lk' },
        'req-2',
      );
      expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
        'leader@tccr.lk',
        expect.stringContaining('Cell Leader'),
        expect.any(String),
        'req-2',
      );
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).toContain('leader@tccr.lk');
      expect(html).toContain('Leader@12345');
      expect(html).toContain('https://reset.link/abc');
      expect(html).toContain('https://tccr.lk');
    });

    it('omits reset-link section when passwordResetUrl is null', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-2', email: 'leader@tccr.lk', firstName: 'Saman', lastName: 'Silva',
          initialPassword: 'Leader@12345', role: 'leader', passwordResetUrl: null },
        'req-2',
      );
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).not.toContain('Set Your Password');
      expect(html).toContain('Change Password');
    });

    it('falls back to "(provided separately)" when initialPassword is omitted', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-2', email: 'leader@tccr.lk', firstName: 'Saman', lastName: 'Silva', role: 'leader' },
        'req-2',
      );
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).toContain('provided separately');
    });
  });

  // ── G12 account ───────────────────────────────────────────────────
  describe('role=g12 (new account)', () => {
    it('sends G12 Leader creation email with credentials and reset link', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-3', email: 'g12@tccr.lk', firstName: 'Nimal', lastName: 'Perera',
          initialPassword: 'G12Lead@123', role: 'g12',
          passwordResetUrl: 'https://reset.link/xyz', systemUrl: 'https://tccr.lk' },
        'req-3',
      );
      expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
        'g12@tccr.lk',
        expect.stringContaining('G12 Leader'),
        expect.any(String),
        'req-3',
      );
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).toContain('g12@tccr.lk');
      expect(html).toContain('G12Lead@123');
      expect(html).toContain('https://reset.link/xyz');
    });
  });

  // ── Admin account (legacy path) ───────────────────────────────────
  describe('admin account creation (no role or role=admin)', () => {
    it('sends account creation email with credentials when promoted=false', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-1', email: 'u@example.com', firstName: 'Bob', lastName: 'Jones',
          promoted: false, initialPassword: 'Secret@123' },
        'req-1',
      );
      expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
        'u@example.com',
        expect.stringContaining('Admin Account has been Created'),
        expect.stringContaining('u@example.com'),
        'req-1',
      );
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).toContain('Secret@123');
    });

    it('sends creation email when promoted is undefined', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-1', email: 'u@example.com', firstName: 'Carol', lastName: 'Lee',
          initialPassword: 'Pass@456' },
        'req-1',
      );
      expect(dispatcher.dispatchEmail).toHaveBeenCalledWith(
        'u@example.com',
        expect.stringContaining('Admin Account has been Created'),
        expect.stringContaining('Pass@456'),
        'req-1',
      );
    });

    it('falls back to placeholder text when initialPassword is omitted', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle({ uid: 'uid-1', email: 'u@example.com', firstName: 'Dave', lastName: 'Gray' }, 'req-1');
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).toContain('set by Super Admin');
    });

    it('includes reset link in admin email when passwordResetUrl is provided', async () => {
      dispatcher.dispatchEmail.mockResolvedValue(undefined);
      await handler.handle(
        { uid: 'uid-1', email: 'u@example.com', firstName: 'Eve', lastName: 'Hunt',
          initialPassword: 'Admin@123', passwordResetUrl: 'https://reset.link/admin', systemUrl: 'https://tccr.lk' },
        'req-1',
      );
      const html = dispatcher.dispatchEmail.mock.calls[0][2];
      expect(html).toContain('https://reset.link/admin');
      expect(html).toContain('https://tccr.lk');
    });
  });

  // ── Error propagation ──────────────────────────────────────────────
  it('propagates errors from dispatchEmail', async () => {
    dispatcher.dispatchEmail.mockRejectedValue(new Error('Email error'));
    await expect(
      handler.handle({ uid: 'uid-1', email: 'u@example.com', firstName: 'X', lastName: 'Y', promoted: true }, 'req-1'),
    ).rejects.toThrow('Email error');
  });
});
