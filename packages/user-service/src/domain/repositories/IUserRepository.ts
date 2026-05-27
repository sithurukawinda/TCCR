import { User, UserRole, UserStatus } from '../entities/User';

export interface FindAllOptions {
  limit:         number;
  cursor?:       string;
  role?:         UserRole;
  status?:       UserStatus;
  name?:         string;
  excludeRoles?: UserRole[];
}

export interface FindAllResult {
  items:      User[];
  nextCursor: string | null;
  total:      number;
}

export interface IUserRepository {
  findById(uid: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(opts: FindAllOptions): Promise<FindAllResult>;
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
  softDelete(uid: string): Promise<void>;
  hardDelete(uid: string): Promise<void>;
}
