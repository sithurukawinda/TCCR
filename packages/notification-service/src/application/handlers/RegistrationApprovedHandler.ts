import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface RegistrationApprovedPayload {
  studentUid: string;
  email:      string;
  firstName?: string;
  lastName?:  string;
  appUrl?:    string;
}

export class RegistrationApprovedHandler {
  constructor(
    private readonly notifRepo:   INotificationRepository,
    private readonly dispatcher:  NotificationDispatcher,
  ) {}

  async handle(payload: RegistrationApprovedPayload, requestId: string): Promise<void> {
    const fullName  = [payload.firstName, payload.lastName].filter(Boolean).join(' ') || 'Member';
    const loginUrl  = payload.appUrl ?? 'https://cms.bethelnet.au/login';

    // ── In-app notification ────────────────────────────────────────────────────
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.studentUid,
      type:      'registration.approved',
      title:     'Registration Approved',
      body:      'Your registration has been approved. You can now log in to TCCR.',
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    // ── Branded approval email ─────────────────────────────────────────────────
    const subject = 'Your Registration has been Approved — TCCR';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#27ae60;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;">The Christian Center Rathmalana</h1>
            <p style="margin:6px 0 0;color:#d5f5e3;font-size:14px;">TCCR Member Portal</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">
              Hi <strong>${fullName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              Great news! Your registration with <strong>The Christian Center Rathmalana (TCCR)</strong>
              has been <strong style="color:#27ae60;">approved</strong>.
              You can now log in and explore the portal.
            </p>
            <!-- Status badge -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f0fff4;border:1px solid #a9dfbf;border-radius:6px;margin:0 0 28px;">
              <tr>
                <td style="padding:16px 24px;text-align:center;">
                  <p style="margin:0;font-size:16px;color:#1e8449;font-weight:bold;">
                    ✅ &nbsp;Registration Status: Approved
                  </p>
                </td>
              </tr>
            </table>
            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:4px 0 28px;">
                  <a href="${loginUrl}"
                     style="display:inline-block;background:#27ae60;color:#ffffff;
                            text-decoration:none;font-size:16px;font-weight:bold;
                            padding:16px 48px;border-radius:6px;">
                    Log in to TCCR &rarr;
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="margin:0;font-size:12px;color:#999;">
                    Or visit: <a href="${loginUrl}" style="color:#27ae60;">${loginUrl}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              Questions? Contact us at
              <a href="mailto:support@tccr.lk" style="color:#27ae60;">support@tccr.lk</a>
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#ccc;">
              &copy; ${new Date().getFullYear()} The Christian Center Rathmalana
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    await this.dispatcher.dispatchEmail(payload.email, subject, html, requestId);
  }
}
