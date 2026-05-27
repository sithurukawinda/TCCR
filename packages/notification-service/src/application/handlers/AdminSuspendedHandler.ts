import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface AdminSuspendedPayload {
  uid:       string;
  email:     string;
  firstName: string;
  lastName:  string;
  reason?:   string | null;
  appUrl?:   string;
}

export class AdminSuspendedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: AdminSuspendedPayload, requestId: string): Promise<void> {
    const fullName = `${payload.firstName} ${payload.lastName}`;

    // ── In-app notification ────────────────────────────────────────────────────
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.uid,
      type:      'admin.suspended',
      title:     'Account Suspended',
      body:      'Your admin account has been suspended. Contact the Super Admin for details.',
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    // ── Branded suspension email ───────────────────────────────────────────────
    const subject = 'Your Admin Account has been Suspended — TCCR';

    const reasonSection = payload.reason
      ? `<div style="background:#fff3f3;border-left:4px solid #e74c3c;padding:12px 16px;
                     margin:20px 0;border-radius:0 4px 4px 0;">
           <p style="margin:0;font-size:14px;color:#1a1a1a;">
             <strong>Reason:</strong><br>${payload.reason}
           </p>
         </div>`
      : `<p style="color:#555;font-size:14px;margin:20px 0;">
           No specific reason was provided. Please contact the Super Admin for details.
         </p>`;

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
          <td style="background:#c0392b;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;">The Christian Center Rathmalana</h1>
            <p style="margin:6px 0 0;color:#f5b7b1;font-size:14px;">TCCR Admin Portal</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">
              Hi <strong>${fullName}</strong>,
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;">
              Your admin account at <strong>The Christian Center Rathmalana (TCCR)</strong>
              has been <strong style="color:#c0392b;">suspended</strong> by a Super Administrator.
              You will not be able to access the admin portal until your account is reactivated.
            </p>
            <!-- Status badge -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fdf2f2;border:1px solid #f5b7b1;border-radius:6px;margin:0 0 8px;">
              <tr>
                <td style="padding:16px 24px;text-align:center;">
                  <p style="margin:0;font-size:16px;color:#c0392b;font-weight:bold;">
                    🚫 &nbsp;Account Status: Suspended
                  </p>
                </td>
              </tr>
            </table>
            ${reasonSection}
            <p style="font-size:14px;color:#555;line-height:1.6;">
              If you believe this was done in error, please contact the Super Administrator
              directly at <a href="mailto:support@tccr.lk" style="color:#c0392b;">support@tccr.lk</a>.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              This is an automated notification from TCCR administration.
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
