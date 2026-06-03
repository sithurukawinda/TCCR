import { Role } from '@shared/auth-middleware';

export interface AnalyticsFilters {
  g12Uid?:    string;
  leaderUid?: string;
  cellType?:  string;
}

/**
 * Resolves the Firestore scope key for the given caller + optional UI filters.
 *
 * Base scope (from role / explicit filter):
 *   admin/super_admin            → "org"
 *   admin + ?g12Uid=x            → "g12:x"
 *   admin/g12 + ?leaderUid=x     → "leader:x"
 *   g12 (no leaderUid override)  → "g12:{uid}"
 *   leader                       → "leader:{uid}"
 *
 * Cell-type dimension appended when ?cellType is present:
 *   "org"        + cellType=care  → "org|care"
 *   "g12:{uid}"  + cellType=care  → "g12:{uid}|care"
 *   "leader:{uid}" + cellType=care → "leader:{uid}|care"
 */
export function resolveScope(
  uid:               string,
  roles:             Role[],
  filters?:          AnalyticsFilters,
  reportsFullAccess?: boolean,
): string {
  let base: string;

  const isAdmin = roles.includes('admin') || roles.includes('super_admin') || roles.includes('master');
  const isG12   = roles.includes('g12');

  // G12 with REPORTS_FULL_ACCESS gets org-wide scope identical to admin/master
  const effectiveAdmin = isAdmin || (isG12 && reportsFullAccess === true);

  if (filters?.leaderUid && (effectiveAdmin || isG12)) {
    // Admin / elevated-G12 / standard-G12 narrowing to a specific leader
    base = `leader:${filters.leaderUid}`;
  } else if (filters?.g12Uid && effectiveAdmin) {
    // Admin narrowing to a specific G12 network
    base = `g12:${filters.g12Uid}`;
  } else if (effectiveAdmin) {
    base = 'org';
  } else if (isG12) {
    // Standard G12 — own network only
    base = `g12:${uid}`;
  } else {
    base = `leader:${uid}`;
  }

  // Append cell-type dimension when requested
  return filters?.cellType ? `${base}|${filters.cellType}` : base;
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
