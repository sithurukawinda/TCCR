import { createHttpError }            from '@shared/errors';
import { OutboxEventPublisher }       from '@shared/events';
import { IRoleRequestRepository }    from '../../domain/repositories/IRoleRequestRepository';
import { RoleRequest }               from '../../domain/entities/RoleRequest';

export class RejectRoleRequestUseCase {
  constructor(
    private readonly roleRequestRepo: IRoleRequestRepository,
    private readonly outbox:          OutboxEventPublisher,
  ) {}

  async execute(id: string, decidedByUid: string, note: string | undefined, requestId: string, callerRoles: string[] = []): Promise<RoleRequest> {
    const req = await this.roleRequestRepo.findById(id);
    if (!req) throw createHttpError(404, 'ROLE_REQUEST_NOT_FOUND', 'Role request not found.');

    if (req.submittedByAdmin && !callerRoles.includes('super_admin')) {
      throw createHttpError(403, 'FORBIDDEN', 'Only super_admin can reject role requests submitted by admin accounts.');
    }

    req.reject(decidedByUid, note); // throws 409 if not pending

    await this.roleRequestRepo.update(req);

    // Release slot so the user can re-apply after rejection.
    // Fire-and-forget — slot cleanup failure must not fail the rejection.
    this.roleRequestRepo.releaseSlot(req.requesterUid).catch(() => { /* non-critical */ });

    await this.outbox.publishWithBatch({
      type:      'role.rejected',
      payload:   { requesterUid: req.requesterUid, role: req.requestedRole, decidedByUid },
      requestId,
    });

    return req;
  }
}
