import { Registration, RegistrationState } from '../entities/Registration';

export interface RegistrationListOptions {
  limit:   number;
  cursor?: string;
  state?:  RegistrationState;
}

export interface RegistrationListResult {
  items:      Registration[];
  nextCursor: string | null;
  total:      number;
}

export interface IRegistrationRepository {
  findById(studentUid: string): Promise<Registration | null>;
  findAll(opts: RegistrationListOptions): Promise<RegistrationListResult>;
  create(reg: Registration): Promise<void>;
  update(reg: Registration): Promise<void>;
}
