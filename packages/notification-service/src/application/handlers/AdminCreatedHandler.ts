import { NotificationDispatcher } from '../services/NotificationDispatcher';

export interface AdminCreatedPayload {
  uid:              string;
  email:            string;
  firstName:        string;
  lastName:         string;
  actorUid?:        string;
  promoted?:        boolean;
  initialPassword?: string;
  /** Role assigned to the newly created user (e.g. 'leader', 'g12', 'admin'). */
  role?:            string;
  /** Firebase password-reset URL — included in the welcome email for new accounts. */
  passwordResetUrl?: string | null;
  /** Front-end system URL shown in the welcome email. */
  systemUrl?:       string | null;
}

const ROLE_LABELS: Record<string, string> = {
  leader: 'Cell Leader',
  g12:    'G12 Leader',
  admin:  'Admin',
};

export class AdminCreatedHandler {
  constructor(
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: AdminCreatedPayload, requestId: string): Promise<void> {
    // Promotion email (existing member elevated to admin)
    if (payload.promoted) {
      const subject = 'You have been promoted to Admin — TCCR';
      const html = `
        <p>Hi ${payload.firstName},</p>
        <p>Your account on the <strong>The Christian Center Rathmalana</strong> portal has been promoted to <strong>Admin</strong>.</p>
        <p>You now have access to manage courses, enrollments, and student registrations.</p>
        <p>Log in with your existing credentials to get started.</p>
        ${payload.systemUrl ? `<p>Access the system at: <a href="${payload.systemUrl}">${payload.systemUrl}</a></p>` : ''}
      `.trim();
      await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
      return;
    }

    const roleLabel = (payload.role && ROLE_LABELS[payload.role]) ?? 'Admin';
    const isLeaderOrG12 = payload.role === 'leader' || payload.role === 'g12';

    // New account creation — leader / g12: dedicated welcome email with credentials + reset link
    if (isLeaderOrG12) {
      const subject = `Your ${roleLabel} Account has been Created — TCCR`;
      const resetSection = payload.passwordResetUrl
        ? `<p style="margin:20px 0;">
             <a href="${payload.passwordResetUrl}"
                style="background:#1a73e8;color:#fff;padding:10px 20px;border-radius:4px;
                       text-decoration:none;font-weight:bold;display:inline-block;">
               Set Your Password →
             </a>
           </p>
           <p style="font-size:12px;color:#666;">
             This link expires in 1 hour. If it has expired, use the <em>Forgot Password</em>
             link on the login page to request a new one.
           </p>`
        : `<p>Please change your temporary password after your first login via <em>My Profile → Change Password</em>.</p>`;

      const html = `
        <p>Hi ${payload.firstName},</p>
        <p>A <strong>${roleLabel}</strong> account has been created for you on
           <strong>The Christian Center Rathmalana (TCCR)</strong> portal.</p>
        <p>Your login credentials are:</p>
        <table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;">
          <tr style="background:#f5f5f5;">
            <td style="border:1px solid #ddd;padding:8px 16px;"><strong>Email</strong></td>
            <td style="border:1px solid #ddd;padding:8px 16px;">${payload.email}</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:8px 16px;"><strong>Temporary Password</strong></td>
            <td style="border:1px solid #ddd;padding:8px 16px;font-family:monospace;">
              ${payload.initialPassword ?? '(provided separately)'}
            </td>
          </tr>
        </table>
        <p style="color:#c0392b;font-weight:bold;">
          ⚠ Please update your password immediately after your first login.
        </p>
        ${resetSection}
        ${payload.systemUrl
          ? `<p>Access the TCCR portal at:
               <a href="${payload.systemUrl}" style="color:#1a73e8;">${payload.systemUrl}</a>
             </p>`
          : ''}
        <p style="color:#555;font-size:13px;">
          If you did not expect this email please contact your system administrator.
        </p>
      `.trim();

      await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
      return;
    }

    // New admin account creation (default / legacy path)
    const subject = 'Your Admin Account has been Created — TCCR';
    const resetSection = payload.passwordResetUrl
      ? `<p>To set a permanent password click:
           <a href="${payload.passwordResetUrl}">Reset Password</a>
         </p>`
      : `<p>We strongly recommend changing your password immediately after your first login.</p>`;

    const html = `
      <p>Hi ${payload.firstName},</p>
      <p>An Admin account has been created for you on the
         <strong>The Christian Center Rathmalana (TCCR)</strong> portal.</p>
      <p>Your login credentials are:</p>
      <table cellpadding="6" style="border-collapse:collapse;">
        <tr>
          <td><strong>Email</strong></td>
          <td>${payload.email}</td>
        </tr>
        <tr>
          <td><strong>Password</strong></td>
          <td style="font-family:monospace;">${payload.initialPassword ?? '(set by Super Admin)'}</td>
        </tr>
      </table>
      ${resetSection}
      ${payload.systemUrl
        ? `<p>Access the system at: <a href="${payload.systemUrl}">${payload.systemUrl}</a></p>`
        : ''}
    `.trim();

    await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
  }
}
