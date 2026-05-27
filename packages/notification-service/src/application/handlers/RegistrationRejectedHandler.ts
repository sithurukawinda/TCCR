import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface RegistrationRejectedPayload {
  studentUid: string;
  email:      string;
  firstName?: string;
  lastName?:  string;
  reason:     string | null;
  appUrl?:    string;
}

export class RegistrationRejectedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: RegistrationRejectedPayload, requestId: string): Promise<void> {
    const fullName   = [payload.firstName, payload.lastName].filter(Boolean).join(' ') || 'Member';
    const loginUrl   = payload.appUrl ?? 'https://cms.bethelnet.au/login';
    const reasonText = payload.reason ?? null;

    // ── In-app notification ────────────────────────────────────────────────────
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.studentUid,
      type:      'registration.rejected',
      title:     'Registration Not Approved',
      body:      reasonText
        ? `Your registration was not approved: ${reasonText}`
        : 'Your registration was not approved at this time.',
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    // ── Branded rejection email ────────────────────────────────────────────────
    const subject = 'Your Registration Update — TCCR';

    const reasonSection = reasonText
      ? `<div style="background:#fff3f3;border-left:4px solid #e74c3c;padding:12px 16px;
                     margin:20px 0;border-radius:0 4px 4px 0;">
           <p style="margin:0;font-size:14px;color:#1a1a1a;">
             <strong>Reason:</strong><br>${reasonText}
           </p>
         </div>`
      : `<p style="color:#555;font-size:14px;margin:20px 0;">
           No specific reason was provided by the administrator.
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
          <td style="background:#1a73e8;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;">The Christian Center Rathmalana</h1>
            <p style="margin:6px 0 0;color:#d0e8ff;font-size:14px;">TCCR Member Portal</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">
              Hi <strong>${fullName}</strong>,
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;">
              Thank you for registering with <strong>The Christian Center Rathmalana (TCCR)</strong>.
              After review, your registration has <strong style="color:#e74c3c;">not been approved</strong>
              at this time.
            </p>
            ${reasonSection}
            <p style="font-size:14px;color:#555;line-height:1.6;">
              If you believe this decision was made in error, or if you have any questions,
              please contact the administration team. You may be eligible to reapply.
            </p>
            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr>
                <td align="center">
                  <a href="${loginUrl}"
                     style="display:inline-block;background:#1a73e8;color:#ffffff;
                            text-decoration:none;font-size:15px;font-weight:bold;
                            padding:14px 40px;border-radius:6px;">
                    Visit TCCR &rarr;
                  </a>
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
              <a href="mailto:support@tccr.lk" style="color:#1a73e8;">support@tccr.lk</a>
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
