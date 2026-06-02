import { IRoleRequestRepository } from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest }            from '../../domain/entities/RoleRequest';

export class GetMyRoleRequestsUseCase {
  constructor(private readonly roleRequestRepo: IRoleRequestRepository) {}

  async execute(requesterUid: string): Promise<RoleRequest[]> {
    const all = await this.roleRequestRepo.findByRequester(requesterUid);
    // findByRequester returns newest-first; keep only the first seen per role
    const seen = new Set<string>();
    return all.filter(req => {
      if (seen.has(req.requestedRole)) return false;
      seen.add(req.requestedRole);
      return true;
    });
  }
}
