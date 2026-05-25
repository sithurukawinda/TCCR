import { createHttpError }          from '@shared/errors';
import { OutboxEventPublisher }     from '@shared/events';
import { IEnrollmentRepository }   from '../../domain/repositories/IEnrollmentRepository';
import { CourseServiceClient }      from '../../infrastructure/clients/CourseServiceClient';
import { Enrollment }               from '../../domain/entities/Enrollment';
import { config }                   from '../../config';

export class CreateEnrollmentUseCase {
  constructor(
    private readonly enrollRepo:  IEnrollmentRepository,
    private readonly courseClient: CourseServiceClient,
    private readonly outbox:       OutboxEventPublisher,
  ) {}

  async execute(studentUid: string, courseId: string, requestId: string): Promise<Enrollment> {
    const isPublished = await this.courseClient.isCoursePublished(courseId);
    if (!isPublished) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found or not published.');

    const existing = await this.enrollRepo.findByStudentAndCourse(studentUid, courseId);
    if (existing) {
      if (existing.state === 'pending') throw createHttpError(409, 'ENROLLMENT_PENDING', 'You already have a pending enrollment for this course.');
      if (existing.state === 'approved') throw createHttpError(409, 'ALREADY_ENROLLED', 'You are already enrolled in this course.');

      // Check cooloff after rejection
      if (existing.state === 'rejected' && existing.rejectedAt) {
        const cooloffMs    = config.cooloffHours * 60 * 60 * 1000;
        const rejectedTime = new Date(existing.rejectedAt).getTime();
        if (Date.now() - rejectedTime < cooloffMs) {
          throw createHttpError(422, 'COOLOFF_ACTIVE', 'You cannot re-enroll within the rejection cooloff period.');
        }
      }
    }

    const now        = new Date().toISOString();
    const enrollment = new Enrollment({
      id:          `${studentUid}_${courseId}`,
      studentUid,
      courseId,
      state:       'pending',
      reason:      null,
      rejectedAt:  null,
      approvedAt:  null,
      withdrawnAt: null,
      createdAt:   now,
      updatedAt:   now,
    });

    await this.enrollRepo.create(enrollment);
    await this.outbox.publishWithBatch({ type: 'enrollment.pending', payload: { studentUid, courseId }, requestId });

    return enrollment;
  }
}
