import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  leader:  'Cell Leader',
  g12:     'G12 Leader',
};

export interface RoleRejectedPayload {
  requesterUid:      string;
  requestedRole:     string;
  /** Student email — enriched by ApproveRoleRequestUseCase fire-and-forget lookup. */
  studentEmail?:     string;
  studentFirstName?: string;
  studentLastName?:  string;
  /** Optional note from the admin. */
  note?:             string | null;
  appUrl?:           string;
}

export class RoleRejectedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: RoleRejectedPayload, requestId: string): Promise<void> {
    const roleLabel  = ROLE_LABELS[payload.requestedRole] ?? payload.requestedRole;
    const fullName   = [payload.studentFirstName, payload.studentLastName].filter(Boolean).join(' ') || 'Member';
    const loginUrl   = payload.appUrl ?? 'https://cms.bethelnet.au/login';

    // ── In-app notification ────────────────────────────────────────────────────
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.requesterUid,
      type:      'role.rejected',
      title:     `${roleLabel} Application Not Approved`,
      body:      `Your application for the ${roleLabel} role was not approved at this time.`,
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    // ── Rejection email (only if email is available) ───────────────────────────
    if (!payload.studentEmail) return;

    const subject = `Your ${roleLabel} Application Update — TCCR`;

    const noteSection = payload.note
      ? `<div style="background:#fff3f3;border-left:4px solid #e74c3c;padding:12px 16px;
                     margin:20px 0;border-radius:0 4px 4px 0;">
           <p style="margin:0;font-size:14px;color:#1a1a1a;">
             <strong>Note from Admin:</strong><br>${payload.note}
           </p>
         </div>`
      : `<p style="color:#555;font-size:14px;margin:20px 0;">
           No specific reason was provided. Please contact the administration for more details.
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
              Thank you for applying for the <strong>${roleLabel}</strong> role at
              <strong>The Christian Center Rathmalana (TCCR)</strong>.
              After careful review, your application has
              <strong style="color:#e74c3c;">not been approved</strong> at this time.
            </p>
            <!-- Status badge -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fdf2f2;border:1px solid #f5b7b1;border-radius:6px;margin:0 0 8px;">
              <tr>
                <td style="padding:16px 24px;text-align:center;">
                  <p style="margin:0;font-size:15px;color:#c0392b;font-weight:bold;">
                    Role Requested: ${roleLabel} &nbsp;|&nbsp; Status: Not Approved
                  </p>
                </td>
              </tr>
            </table>
            ${noteSection}
            <p style="font-size:14px;color:#555;line-height:1.6;">
              We encourage you to continue participating in TCCR activities.
              You may be eligible to reapply in the future. If you have any questions,
              please reach out to the administration team.
            </p>
            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr>
                <td align="center" style="padding:4px 0 20px;">
                  <a href="${loginUrl}"
                     style="display:inline-block;background:#1a73e8;color:#ffffff;
                            text-decoration:none;font-size:15px;font-weight:bold;
                            padding:14px 40px;border-radius:6px;">
                    Log in to TCCR &rarr;
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

    await this.dispatcher.dispatchEmail(payload.studentEmail, subject, html, requestId);
  }
}
