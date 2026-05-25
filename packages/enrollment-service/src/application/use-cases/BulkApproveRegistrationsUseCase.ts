import { ApproveRegistrationUseCase } from './ApproveRegistrationUseCase';

export interface BulkApproveResult {
  approved: string[];
  failed:   Array<{ id: string; reason: string }>;
}

export class BulkApproveRegistrationsUseCase {
  constructor(private readonly approveUseCase: ApproveRegistrationUseCase) {}

  async execute(ids: string[], requestId: string): Promise<BulkApproveResult> {
    const results = await Promise.allSettled(
      ids.map(id => this.approveUseCase.execute(id, requestId)),
    );

    const approved: string[]                         = [];
    const failed: Array<{ id: string; reason: string }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        approved.push(ids[index]);
      } else {
        failed.push({ id: ids[index], reason: (result.reason as Error).message });
      }
    });

    return { approved, failed };
  }
}
