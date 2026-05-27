import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

const PRIORITY_UP: Partial<Record<TicketPriority, TicketPriority>> = {
  [TicketPriority.LOW]: TicketPriority.MEDIUM,
  [TicketPriority.MEDIUM]: TicketPriority.HIGH,
  [TicketPriority.HIGH]: TicketPriority.CRITICAL,
};

@Injectable()
export class SchedulerService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runEscalation(): Promise<void> {
    const overdueTickets = await this.ticketRepo
      .createQueryBuilder('t')
      .where('t.dueDate IS NOT NULL')
      .andWhere('t.dueDate < :now', { now: new Date() })
      .andWhere('t.priority != :critical', { critical: TicketPriority.CRITICAL })
      .andWhere('t.status != :done', { done: TicketStatus.DONE })
      .andWhere('t.deletedAt IS NULL')
      .getMany();

    for (const ticket of overdueTickets) {
      const newPriority = PRIORITY_UP[ticket.priority];
      if (!newPriority) continue;

      ticket.priority = newPriority;
      if (newPriority === TicketPriority.CRITICAL) {
        ticket.isOverdue = true;
      }

      await this.ticketRepo.save(ticket);
      await this.auditLogsService.log({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.TICKET,
        entityId: ticket.id,
        actor: AuditActor.SYSTEM,
      });
    }
  }

  async autoAssign(ticket: Ticket): Promise<void> {
    if (ticket.assigneeId) return;

    const developers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.DEVELOPER })
      .orderBy('u.createdAt', 'ASC')
      .getMany();

    if (developers.length === 0) return;

    const counts = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.assigneeId', 'assigneeId')
      .addSelect('COUNT(t.id)', 'cnt')
      .where('t.projectId = :projectId', { projectId: ticket.projectId })
      .andWhere('t.status != :done', { done: TicketStatus.DONE })
      .andWhere('t.deletedAt IS NULL')
      .andWhere('t.assigneeId IN (:...ids)', { ids: developers.map(d => d.id) })
      .groupBy('t.assigneeId')
      .getRawMany();

    const countMap = new Map(counts.map(r => [Number(r.assigneeId), Number(r.cnt)]));

    let selected = developers[0];
    let minCount = countMap.get(selected.id) ?? 0;
    for (const dev of developers.slice(1)) {
      const cnt = countMap.get(dev.id) ?? 0;
      if (cnt < minCount) {
        selected = dev;
        minCount = cnt;
      }
    }

    await this.ticketRepo.update(ticket.id, { assigneeId: selected.id });
    await this.auditLogsService.log({
      action: AuditAction.AUTO_ASSIGN,
      entityType: AuditEntityType.TICKET,
      entityId: ticket.id,
      actor: AuditActor.SYSTEM,
    });
  }
}
