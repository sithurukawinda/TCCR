import { createHttpError }            from '@shared/errors';
import { OutboxEventPublisher }       from '@shared/events';
import { IRoleRequestRepository }    from '../../domain/repositories/IRoleRequestRepository';
import { UserServiceClient }         from '../../infrastructure/clients/UserServiceClient';
import { RoleRequest }               from '../../domain/entities/RoleRequest';
import { config }                    from '../../config';

export class ApproveRoleRequestUseCase {
  constructor(
    private readonly roleRequestRepo: IRoleRequestRepository,
    private readonly userClient:      UserServiceClient,
    private readonly outbox:          OutboxEventPublisher,
  ) {}

  async execute(id: string, decidedByUid: string, note: string | undefined, requestId: string, callerRoles: string[] = []): Promise<RoleRequest> {
    const req = await this.roleRequestRepo.findById(id);
    if (!req) throw createHttpError(404, 'ROLE_REQUEST_NOT_FOUND', 'Role request not found.');

    if (req.submittedByAdmin && !callerRoles.includes('super_admin')) {
      throw createHttpError(403, 'FORBIDDEN', 'Only super_admin can approve role requests submitted by admin accounts.');
    }

    req.approve(decidedByUid, note); // throws 409 if not pending

    // Grant the role on the user — adds 'student' to roles[] and updates Firebase claims
    await this.userClient.addRole(req.requesterUid, req.requestedRole);

    await this.roleRequestRepo.update(req);

    // Release the pending slot so the user can re-apply if needed.
    // Fire-and-forget — slot cleanup failure must not fail the approval.
    // Legacy requests (pre-fix) have no slot; delete() is a no-op in that case.
    this.roleRequestRepo.releaseSlot(req.requesterUid).catch(() => { /* non-critical */ });

    // Enrich outbox payload with student details for the approval email.
    // Fire-and-forget — never blocks the role grant if user-service is unavailable.
    const student = await this.userClient.getUser(req.requesterUid).catch(() => null);

    await this.outbox.publishWithBatch({
      type:    'role.granted',
      payload: {
        requesterUid:     req.requesterUid,
        role:             req.requestedRole,
        decidedByUid,
        email:            student?.email     ?? undefined,
        studentFirstName: student?.firstName ?? undefined,
        studentLastName:  student?.lastName  ?? undefined,
        note:             note               ?? undefined,
        appUrl:           config.appUrl,
      },
      requestId,
    });

    return req;
  }
}
