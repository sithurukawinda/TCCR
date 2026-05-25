import { getFirestore } from 'firebase-admin/firestore';

export interface OtpRecord {
  email:     string;
  otp:       string;
  expiresAt: string;
  attempts:  number;
}

export interface IOtpRepository {
  save(record: OtpRecord): Promise<void>;
  findByEmail(email: string): Promise<OtpRecord | null>;
  delete(email: string): Promise<void>;
}

export class FirestoreOtpRepository implements IOtpRepository {
  private readonly col = getFirestore().collection('passwordResetOtps');

  async save(record: OtpRecord): Promise<void> {
    await this.col.doc(record.email).set(record);
  }

  async findByEmail(email: string): Promise<OtpRecord | null> {
    const snap = await this.col.doc(email).get();
    if (!snap.exists) return null;
    return snap.data() as OtpRecord;
  }

  async delete(email: string): Promise<void> {
    await this.col.doc(email).delete();
  }
}
