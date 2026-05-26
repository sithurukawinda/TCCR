/**
 * scripts/test-smtp.js
 * One-off SMTP smoke test — verifies that cvking0001@gmail.com can relay mail.
 * Usage: node scripts/test-smtp.js [recipient@example.com]
 *        Defaults to sending back to SMTP_USER (self-test).
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const {
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} = process.env;

if (!SMTP_USER || !SMTP_PASS) {
  console.error('❌  SMTP_USER or SMTP_PASS is not set in .env');
  process.exit(1);
}

const recipient = process.argv[2] || SMTP_USER; // default: self-test

const transport = nodemailer.createTransport({
  host:   SMTP_HOST,
  port:   Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth:   { user: SMTP_USER, pass: SMTP_PASS },
});

async function main() {
  console.log(`\n📧  SMTP smoke test`);
  console.log(`    Host    : ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`    From    : ${EMAIL_FROM || SMTP_USER}`);
  console.log(`    To      : ${recipient}`);
  console.log('    Verifying connection…');

  await transport.verify();
  console.log('    ✅  SMTP connection OK\n    Sending test email…');

  const info = await transport.sendMail({
    from:    `"TCCR System" <${EMAIL_FROM || SMTP_USER}>`,
    to:      recipient,
    subject: '✅ TCCR SMTP smoke test',
    html: `
      <h2 style="color:#1a73e8;">SMTP is working!</h2>
      <p>This is a test email from the <strong>TCCR backend</strong>.</p>
      <p>Sent via <code>${SMTP_HOST}:${SMTP_PORT}</code> using <code>${SMTP_USER}</code>.</p>
      <hr/>
      <p style="font-size:12px;color:#888;">Sent at ${new Date().toISOString()}</p>
    `,
  });

  console.log(`    ✅  Email sent!  messageId: ${info.messageId}`);
  console.log(`\n    Check the inbox at ${recipient}\n`);
}

main().catch(err => {
  console.error('\n❌  SMTP test FAILED:\n', err.message || err);
  if (err.code === 'EAUTH') {
    console.error(
      '\n    Hint: Gmail rejected the credentials.\n' +
      '    → Make sure 2-Step Verification is ON for cvking0001@gmail.com\n' +
      '    → Generate a fresh App Password at https://myaccount.google.com/apppasswords\n' +
      '    → Update SMTP_PASS in .env with the new 16-char code\n',
    );
  }
  process.exit(1);
});
