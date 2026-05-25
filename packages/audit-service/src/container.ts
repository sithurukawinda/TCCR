import { FirestoreAuditRepository } from './infrastructure/repositories/FirestoreAuditRepository';
import { AuditEventHandler }        from './application/handlers/AuditEventHandler';
import { AuditController }          from './http/controllers/AuditController';
import { AuditEventController }     from './http/controllers/AuditEventController';

const auditRepo     = new FirestoreAuditRepository();
const auditHandler  = new AuditEventHandler(auditRepo);

export const container = {
  auditController:      new AuditController(auditRepo),
  auditEventController: new AuditEventController(auditHandler),
};
