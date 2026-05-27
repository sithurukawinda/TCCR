import { CellReport } from '../entities/CellReport';

export interface CellReportListOptions {
  limit:      number;
  cursor?:    string;
  from?:      string;
  to?:        string;
  voided?:    boolean;
  leaderUid?: string;                                    // filter to cells led by this person
  type?:      'g12' | 'care' | 'children' | 'outreach'; // filter by cell type
  cellId?:    string;                                    // filter to one specific cell
}

export interface CellReportListResult {
  items:      CellReport[];
  nextCursor: string | null;
  total:      number;
}

export interface ICellReportRepository {
  findById(cellId: string, id: string): Promise<CellReport | null>;
  findByClientReqId(cellId: string, clientReqId: string): Promise<CellReport | null>;
  findAll(cellId: string, opts: CellReportListOptions): Promise<CellReportListResult>;
  create(report: CellReport): Promise<void>;
  update(report: CellReport): Promise<void>;
}
