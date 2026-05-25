import { getFirestore } from 'firebase-admin/firestore';

export interface LoginAttempts {
  email:       string;
  attempts:    number;
  windowStart: string;
}

export interface ILoginAttemptsRepository {
  findByEmail(email: string): Promise<LoginAttempts | null>;
  save(data: LoginAttempts): Promise<void>;
}

export class FirestoreLoginAttemptsRepository implements ILoginAttemptsRepository {
  private readonly col = getFirestore().collection('loginAttempts');

  async findByEmail(email: string): Promise<LoginAttempts | null> {
    const snap = await this.col.doc(email).get();
    if (!snap.exists) return null;
    return snap.data() as LoginAttempts;
  }

  async save(data: LoginAttempts): Promise<void> {
    await this.col.doc(data.email).set(data);
  }
}
