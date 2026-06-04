import { IRoleRequestRepository, RoleRequestListOptions, RoleRequestListResult } from '../../domain/repositories/IRoleRequestRepository';

export class GetRoleRequestsUseCase {
  constructor(private readonly roleRequestRepo: IRoleRequestRepository) {}

  async execute(opts: RoleRequestListOptions, callerRoles: string[]): Promise<RoleRequestListResult> {
    const query: RoleRequestListOptions = { ...opts };
    // admin callers see only non-admin-submitted requests; super_admin sees all
    if (!callerRoles.includes('super_admin')) {
      query.submittedByAdmin = false;
    }
    return this.roleRequestRepo.findAll(query);
  }
}
