import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';
import { UserServiceClient }         from '../../infrastructure/clients/UserServiceClient';

export interface UserRegisteredPayload {
  uid:       string;
  email:     string;
  firstName: string;
  lastName:  string;
  /** Plain-text password included so the welcome email can show login credentials. */
  password?: string;
  /** System URL for the login page — used as fallback CTA. */
  appUrl?:   string;
  /** Firebase email verification link — user clicks this to activate their account. */
  verificationLink?: string | null;
}

export class UserRegisteredHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly userClient: UserServiceClient,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: UserRegisteredPayload, requestId: string): Promise<void> {
    const adminUids = await this.userClient.getAdminUids();
    const now       = new Date().toISOString();
    const fullName  = `${payload.firstName} ${payload.lastName}`;

    // ── In-app notification to all admins ──────────────────────────────────────
    // V2: members are active immediately — no "pending approval" step
    await Promise.all(adminUids.map(adminUid =>
      this.notifRepo.create(new Notification({
        id:        uuidv4(),
        userUid:   adminUid,
        type:      'user.registered',
        title:     'New Member Joined',
        body:      `${fullName} has registered and joined TCCR as a Member.`,
        read:      false,
        createdAt: now,
      })),
    ));

    // ── Welcome email to the new member ────────────────────────────────────────
    const subject         = 'Welcome to TCCR — Please Verify Your Email';
    const loginUrl        = payload.appUrl ?? 'https://cms.bethelnet.au/login';
    const verificationLink = payload.verificationLink ?? null;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a73e8;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:0.5px;">
              The Christian Center Rathmalana
            </h1>
            <p style="margin:4px 0 0;color:#d0e8ff;font-size:13px;">TCCR Member Portal</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;text-align:center;">

            <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#1a1a1a;">
              Welcome, ${fullName}! 👋
            </p>

            <p style="margin:0 0 32px;font-size:14px;color:#666;line-height:1.7;">
              Your TCCR account has been created successfully.<br>
              Please verify your email address to activate your account<br>
              and start using the portal.
            </p>

            ${verificationLink ? `
            <!-- Verify button -->
            <a href="${verificationLink}"
               style="display:inline-block;background:#27ae60;color:#ffffff;
                      text-decoration:none;font-size:15px;font-weight:bold;
                      padding:14px 44px;border-radius:6px;margin-bottom:12px;">
              ✅ &nbsp;Verify My Email
            </a>
            <p style="margin:0 0 32px;font-size:12px;color:#999;">
              Link expires in 24 hours
            </p>` : ''}

            <!-- Login button -->
            <a href="${loginUrl}"
               style="display:inline-block;background:#1a73e8;color:#ffffff;
                      text-decoration:none;font-size:15px;font-weight:bold;
                      padding:14px 44px;border-radius:6px;margin-bottom:32px;">
              Log in to TCCR &rarr;
            </a>

            <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
              If you did not create this account, please ignore this email or contact
              <a href="mailto:support@tccr.lk" style="color:#1a73e8;">support@tccr.lk</a>
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:16px 40px;
                     border-top:1px solid #eee;text-align:center;">
            <p style="margin:0;font-size:12px;color:#ccc;">
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
