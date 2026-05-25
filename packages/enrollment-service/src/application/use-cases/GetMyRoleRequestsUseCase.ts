import { IRoleRequestRepository } from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest }            from '../../domain/entities/RoleRequest';

export class GetMyRoleRequestsUseCase {
  constructor(private readonly roleRequestRepo: IRoleRequestRepository) {}

  async execute(requesterUid: string): Promise<RoleRequest[]> {
    return this.roleRequestRepo.findByRequester(requesterUid);
  }
}
