import { Role } from '@shared/auth-middleware';

export function resolveScope(uid: string, roles: Role[]): string {
  if (roles.includes('admin') || roles.includes('super_admin')) return 'org';
  if (roles.includes('g12'))    return `g12:${uid}`;
  if (roles.includes('leader')) return `leader:${uid}`;
  return `leader:${uid}`;
}

export function getISOWeekKey(date: Date): string {
  const d       = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum  = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart  = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum    = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function lastNWeekKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    keys.push(getISOWeekKey(d));
  }
  return keys;
}
