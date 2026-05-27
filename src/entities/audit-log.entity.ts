import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'enum', enum: AuditEntityType })
  entityType: AuditEntityType;

  @Column()
  entityId: number;

  @Column({ nullable: true })
  performedBy: number;

  @Column({ type: 'enum', enum: AuditActor })
  actor: AuditActor;

  @CreateDateColumn()
  timestamp: Date;
}
