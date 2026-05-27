import { AuditAction } from '../../common/enums/audit-action.enum';
import { AuditActor } from '../../common/enums/audit-actor.enum';
import { AuditEntityType } from '../../common/enums/audit-entity-type.enum';

export class CreateAuditLogDto {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number;
  performedBy?: number;
  actor: AuditActor;
}
