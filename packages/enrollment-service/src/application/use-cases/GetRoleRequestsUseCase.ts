import { IRoleRequestRepository, RoleRequestListOptions, RoleRequestListResult } from '../../domain/repositories/IRoleRequestRepository';

export class GetRoleRequestsUseCase {
  constructor(private readonly roleRequestRepo: IRoleRequestRepository) {}

  async execute(opts: RoleRequestListOptions): Promise<RoleRequestListResult> {
    return this.roleRequestRepo.findAll(opts);
  }
}
