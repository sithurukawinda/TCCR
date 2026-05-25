import { Router } from 'express';
import { getFirestore } from 'firebase-admin/firestore';

export const healthRouter = Router();

// Liveness — process is alive
healthRouter.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: process.env.SERVICE_NAME });
});

// Readiness — Firestore is reachable. Hard 5-second timeout so a slow emulator
// never causes the probe to hang until Newman's 15-second request timeout fires.
healthRouter.get('/readyz', async (_req, res) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore probe timed out')), 5000);
  });
  try {
    await Promise.race([
      getFirestore().collection('_health').doc('probe').get(),
      timeout,
    ]);
    clearTimeout(timer);
    res.json({ status: 'ready' });
  } catch {
    clearTimeout(timer);
    res.status(503).json({ status: 'not_ready', error: 'Firestore unreachable' });
  }
});
