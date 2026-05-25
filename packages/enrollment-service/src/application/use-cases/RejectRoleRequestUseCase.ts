import { createHttpError }            from '@shared/errors';
import { OutboxEventPublisher }       from '@shared/events';
import { IRoleRequestRepository }    from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest }               from '../../domain/entities/RoleRequest';

export class RejectRoleRequestUseCase {
  constructor(
    private readonly roleRequestRepo: IRoleRequestRepository,
    private readonly outbox:          OutboxEventPublisher,
  ) {}

  async execute(id: string, decidedByUid: string, note: string | undefined, requestId: string): Promise<RoleRequest> {
    const req = await this.roleRequestRepo.findById(id);
    if (!req) throw createHttpError(404, 'ROLE_REQUEST_NOT_FOUND', 'Role request not found.');

    req.reject(decidedByUid, note); // throws 409 if not pending

    await this.roleRequestRepo.update(req);

    await this.outbox.publishWithBatch({
      type:      'role.rejected',
      payload:   { requesterUid: req.requesterUid, role: req.requestedRole, decidedByUid },
      requestId,
    });

    return req;
  }
}
