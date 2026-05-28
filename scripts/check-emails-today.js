#!/usr/bin/env node
/**
 * Check how many emails were sent today via the outbox + notifications collections.
 * Reads credentials from .env.local
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

async function main() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); // midnight local
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  console.log(`\nChecking emails sent on ${start.toDateString()} (local time)\n`);

  const emailEventTypes = [
    'user.registered',
    'enrollment.approved',
    'enrollment.rejected',
    'admin.created',
    'admin.suspended',
    'role.granted',
    'cell.ownership_transferred',
  ];

  // ── 1. Outbox: query by processedAt only, filter status + type in JS ─────
  const outboxSnap = await db.collection('outbox')
    .where('processedAt', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('processedAt', '<=', admin.firestore.Timestamp.fromDate(end))
    .get();

  const emailEvents = outboxSnap.docs.filter(d => {
    const data = d.data();
    return data.status === 'delivered' && emailEventTypes.includes(data.eventType);
  });

  const byType = {};
  for (const doc of emailEvents) {
    const t = doc.data().eventType;
    byType[t] = (byType[t] || 0) + 1;
  }

  // ── 2. Notifications: query by createdAt only, filter channel in JS ───────
  const notifSnap = await db.collection('notifications')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(end))
    .get();
  const emailNotifs = notifSnap.docs.filter(d => d.data().channel === 'email');

  // ── 3. OTP emails sent directly via SMTP (not through outbox pipeline) ────
  const [otpVerifySnap, otpResetSnap] = await Promise.all([
    db.collection('emailVerificationOtps').get().catch(() => ({ size: 0, docs: [] })),
    db.collection('passwordResetOtps').get().catch(() => ({ size: 0, docs: [] })),
  ]);

  const filterToday = doc => {
    const d = doc.data();
    const ts = d.createdAt?.toDate?.() ?? (d.createdAt ? new Date(d.createdAt) : null);
    return ts && ts >= start && ts <= end;
  };
  const otpVerifyToday = otpVerifySnap.docs.filter(filterToday);
  const otpResetToday  = otpResetSnap.docs.filter(filterToday);

  // ── Output ────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  EMAIL SEND SUMMARY — TODAY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n📬 Outbox-triggered emails (welcome, enrollment, admin, role):');
  if (Object.keys(byType).length === 0) {
    console.log('   None');
  } else {
    for (const [type, count] of Object.entries(byType)) {
      console.log(`   ${type.padEnd(35)} × ${count}`);
    }
  }
  console.log(`   SUBTOTAL: ${emailEvents.length}`);

  console.log('\n🔔 Notification-channel emails logged:');
  console.log(`   SUBTOTAL: ${emailNotifs.length}`);

  console.log('\n🔑 OTP emails sent directly via SMTP:');
  console.log(`   Email verification OTPs created today : ${otpVerifyToday.length}`);
  console.log(`   Password reset OTPs created today     : ${otpResetToday.length}`);
  console.log(`   SUBTOTAL: ${otpVerifyToday.length + otpResetToday.length}`);

  const total = emailEvents.length + otpVerifyToday.length + otpResetToday.length;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ESTIMATED TOTAL EMAILS TODAY : ${total}`);
  console.log(`  Gmail free limit             : 500 / day`);
  console.log(`  Remaining (approx)           : ${Math.max(0, 500 - total)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await admin.app().delete();
}

main().catch(err => { console.error(err); process.exit(1); });
