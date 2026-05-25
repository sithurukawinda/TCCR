import { createHttpError } from '@shared/errors';

export type CourseState = 'draft' | 'published' | 'archived';

export interface CourseProps {
  id:             string;
  title:          string;
  description:    string;
  coverImageUrl:  string | null;
  state:          CourseState;
  createdBy:      string;
  semesterCount:  number;
  publishedAt:    string | null;
  deletedAt:      string | null;
  createdAt:      string;
  updatedAt:      string;
}

export class Course {
  id:             string;
  title:          string;
  description:    string;
  coverImageUrl:  string | null;
  state:          CourseState;
  readonly createdBy: string;
  semesterCount:  number;
  publishedAt:    string | null;
  deletedAt:      string | null;
  readonly createdAt: string;
  updatedAt:      string;

  constructor(props: CourseProps) {
    this.id            = props.id;
    this.title         = props.title;
    this.description   = props.description;
    this.coverImageUrl = props.coverImageUrl;
    this.state         = props.state;
    this.createdBy     = props.createdBy;
    this.semesterCount = props.semesterCount;
    this.publishedAt   = props.publishedAt;
    this.deletedAt     = props.deletedAt;
    this.createdAt     = props.createdAt;
    this.updatedAt     = props.updatedAt;
  }

  publish(): void {
    if (this.state !== 'draft') {
      throw createHttpError(409, 'INVALID_STATE', 'Course must be in DRAFT state to publish.');
    }
    this.state       = 'published';
    this.publishedAt = new Date().toISOString();
    this.updatedAt   = new Date().toISOString();
  }

  unpublish(): void {
    if (this.state !== 'published') {
      throw createHttpError(409, 'INVALID_STATE', 'Only a PUBLISHED course can be unpublished.');
    }
    this.state       = 'draft';
    this.publishedAt = null;
    this.updatedAt   = new Date().toISOString();
  }

  archive(): void {
    if (this.state !== 'published') {
      throw createHttpError(409, 'INVALID_STATE', 'Only a PUBLISHED course can be archived.');
    }
    this.state     = 'archived';
    this.updatedAt = new Date().toISOString();
  }

  restore(): void {
    if (this.state !== 'archived') {
      throw createHttpError(409, 'INVALID_STATE', 'Only an ARCHIVED course can be restored.');
    }
    this.state     = 'draft';
    this.updatedAt = new Date().toISOString();
  }

  softDelete(): void {
    this.deletedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  update(fields: { title?: string; description?: string; coverImageUrl?: string | null }): void {
    if (fields.title         !== undefined) this.title         = fields.title;
    if (fields.description   !== undefined) this.description   = fields.description;
    if (fields.coverImageUrl !== undefined) this.coverImageUrl = fields.coverImageUrl;
    this.updatedAt = new Date().toISOString();
  }
}
