import { getAuth }      from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const API_KEY       = 'fake-key';
const PROJECT_ID    = process.env.FIREBASE_PROJECT_ID ?? 'e-learning-f4209';

// ── Token helpers ─────────────────────────────────────────────────────────────

export async function createTestUser(
  email:    string,
  password: string,
  role:     'member' | 'student' | 'admin' | 'super_admin',
  roles?:   string[],
): Promise<{ uid: string; idToken: string }> {
  const record = await getAuth().createUser({ email, password });
  const effectiveRoles = roles ?? [role];
  await getAuth().setCustomUserClaims(record.uid, { role, roles: effectiveRoles });
  const customToken = await getAuth().createCustomToken(record.uid);
  const idToken     = await exchangeToken(customToken);
  return { uid: record.uid, idToken };
}

async function exchangeToken(customToken: string): Promise<string> {
  const res  = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}&project=${PROJECT_ID}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = await res.json() as { idToken: string };
  return data.idToken;
}

// ── Firestore cleanup ─────────────────────────────────────────────────────────

export async function clearCollection(name: string): Promise<void> {
  const snap  = await getFirestore().collection(name).limit(100).get();
  const batch = getFirestore().batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  if (!snap.empty) await batch.commit();
}

export async function clearAuth(): Promise<void> {
  const { users } = await getAuth().listUsers(100);
  await Promise.all(
    users.map(u => getAuth().deleteUser(u.uid).catch(() => { /* already deleted */ })),
  );
}

// ── Firestore seed helpers ────────────────────────────────────────────────────

export function now(): string {
  return new Date().toISOString();
}

export function bearerHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
