import { IUserRepository }  from '../../domain/repositories/IUserRepository';
import { User }             from '../../domain/entities/User';
import { Role }             from '@shared/auth-middleware';

/** Lightweight profile returned for each user in the summary. */
export interface SummaryProfile {
  uid:             string;
  firstName:       string;
  lastName:        string;
  displayName:     string;
  email:           string;
  profilePhotoUrl: string | null;
}

export interface UserSummaryResult {
  superAdmins: SummaryProfile[];
  admins:      SummaryProfile[];
  g12:         SummaryProfile[];
  leaders:     SummaryProfile[];
  students:    SummaryProfile[];
  members:     SummaryProfile[];
  totals: {
    superAdmins: number;
    admins:      number;
    g12:         number;
    leaders:     number;
    students:    number;
    members:     number;
    total:       number;
  };
}

/**
 * GET /users/summary
 *
 * Returns all approved, non-deleted users grouped by their highest role:
 *   super_admin > admin > g12 > leader > student > member
 *
 * Each user appears in exactly ONE group — the highest role they hold.
 * Internally paginates the Firestore query (100/page) until all users
 * are loaded, then groups in memory.
 */
export class GetUserSummaryUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(callerRoles: Role[] = []): Promise<UserSummaryResult> {
    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');

    // Drain all approved users via internal cursor pagination.
    // Leaders and G12 receive the same scoped view as GET /users — no admin/super_admin profiles.
    const allUsers: User[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.userRepo.findAll({
        limit:  100,
        cursor,
        status: 'approved',
        ...(!isAdmin ? { excludeRoles: ['admin', 'super_admin'] } : {}),
      });
      allUsers.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    // Group each user into exactly one bucket based on highest role
    const groups = {
      superAdmins: [] as SummaryProfile[],
      admins:      [] as SummaryProfile[],
      g12:         [] as SummaryProfile[],
      leaders:     [] as SummaryProfile[],
      students:    [] as SummaryProfile[],
      members:     [] as SummaryProfile[],
    };

    for (const user of allUsers) {
      const roles = user.roles ?? [];
      const p = toProfile(user);

      if (roles.includes('super_admin'))      groups.superAdmins.push(p);
      else if (roles.includes('admin'))       groups.admins.push(p);
      else if (roles.includes('g12'))         groups.g12.push(p);
      else if (roles.includes('leader'))      groups.leaders.push(p);
      else if (roles.includes('student'))     groups.students.push(p);
      else                                    groups.members.push(p);
    }

    // Sort each group alphabetically by displayName
    const sortByName = (a: SummaryProfile, b: SummaryProfile) =>
      a.displayName.localeCompare(b.displayName);

    groups.superAdmins.sort(sortByName);
    groups.admins.sort(sortByName);
    groups.g12.sort(sortByName);
    groups.leaders.sort(sortByName);
    groups.students.sort(sortByName);
    groups.members.sort(sortByName);

    const total =
      groups.superAdmins.length +
      groups.admins.length +
      groups.g12.length +
      groups.leaders.length +
      groups.students.length +
      groups.members.length;

    return {
      ...groups,
      totals: {
        superAdmins: groups.superAdmins.length,
        admins:      groups.admins.length,
        g12:         groups.g12.length,
        leaders:     groups.leaders.length,
        students:    groups.students.length,
        members:     groups.members.length,
        total,
      },
    };
  }
}

function toProfile(user: User): SummaryProfile {
  const firstName = user.firstName ?? '';
  const lastName  = user.lastName  ?? '';
  return {
    uid:             user.uid,
    firstName,
    lastName,
    displayName:     `${firstName} ${lastName}`.trim() || user.email,
    email:           user.email,
    profilePhotoUrl: user.profilePhotoUrl,
  };
}
