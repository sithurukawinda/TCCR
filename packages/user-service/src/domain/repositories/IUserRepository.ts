import { User, UserRole, UserStatus } from '../entities/User';

export interface FindAllOptions {
  limit:          number;
  cursor?:        string;
  role?:          UserRole;          // scalar `role` field equality
  roleInArray?:   UserRole;          // `roles[]` array-contains query
  status?:        UserStatus;
  name?:          string;
  excludeRoles?:  UserRole[];
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
  atomicAddRole(uid: string, role: UserRole): Promise<void>;
  atomicRemoveRole(uid: string, role: UserRole): Promise<void>;
  softDelete(uid: string): Promise<void>;
  hardDelete(uid: string): Promise<void>;
}
