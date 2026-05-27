import { getFirestore }                   from 'firebase-admin/firestore';
import { CellReport, CellReportProps }   from '../../domain/entities/CellReport';
import { ICellReportRepository,
         CellReportListOptions,
         CellReportListResult }          from '../../domain/repositories/ICellReportRepository';

function toEntity(id: string, data: Omit<CellReportProps, 'id'>): CellReport {
  return new CellReport({ ...data, id });
}

export class FirestoreCellReportRepository implements ICellReportRepository {
  private col(cellId: string) {
    return getFirestore().collection('cell_groups').doc(cellId).collection('cell_reports');
  }

  async findById(cellId: string, id: string): Promise<CellReport | null> {
    const snap = await this.col(cellId).doc(id).get();
    if (!snap.exists) return null;
    return toEntity(snap.id, snap.data() as Omit<CellReportProps, 'id'>);
  }

  async findByClientReqId(cellId: string, clientReqId: string): Promise<CellReport | null> {
    const snap = await this.col(cellId)
      .where('clientReqId', '==', clientReqId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return toEntity(d.id, d.data() as Omit<CellReportProps, 'id'>);
  }

  async findAll(cellId: string, opts: CellReportListOptions): Promise<CellReportListResult> {
    let q = this.col(cellId) as FirebaseFirestore.Query;

    if (opts.voided !== undefined) q = q.where('voided', '==', opts.voided);
    if (opts.from)                 q = q.where('date', '>=', opts.from);
    if (opts.to)                   q = q.where('date', '<=', opts.to);

    const total = (await q.count().get()).data().count;
    q = q.orderBy('date', 'desc').limit(opts.limit);

    if (opts.cursor) {
      const cs = await this.col(cellId).doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }

    const snap  = await q.get();
    const items = snap.docs.map(d => toEntity(d.id, d.data() as Omit<CellReportProps, 'id'>));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async findByPeriod(cellId: string, from: string, to: string): Promise<CellReport[]> {
    const snap = await this.col(cellId)
      .where('voided', '==', false)
      .where('date',   '>=', from)
      .where('date',   '<=', to)
      .orderBy('date', 'desc')
      .get();
    return snap.docs.map(d => toEntity(d.id, d.data() as Omit<CellReportProps, 'id'>));
  }

  async create(report: CellReport): Promise<void> {
    const { id, ...doc } = { ...report } as CellReportProps;
    await this.col(report.cellId).doc(id).set(doc);
  }

  async update(report: CellReport): Promise<void> {
    const { id, ...doc } = { ...report } as CellReportProps;
    await this.col(report.cellId).doc(id).update(doc as Record<string, unknown>);
  }
}
