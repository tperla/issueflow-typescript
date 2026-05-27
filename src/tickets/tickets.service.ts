import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketType } from '../common/enums/ticket-type.enum';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ticketsToCsv, csvToRows } from './helpers/csv.helper';

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.TODO]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.IN_REVIEW, TicketStatus.TODO],
  [TicketStatus.IN_REVIEW]: [TicketStatus.DONE, TicketStatus.IN_PROGRESS],
  [TicketStatus.DONE]: [],
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findAll(projectId: number): Promise<Ticket[]> {
    return this.ticketRepo.findBy({ projectId });
  }

  async findOne(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOneBy({ id });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }

  async create(dto: CreateTicketDto, performedBy: number): Promise<Ticket> {
    const isOverdue = dto.dueDate ? new Date(dto.dueDate) < new Date() : false;
    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({ ...dto, isOverdue }),
    );
    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.TICKET,
      entityId: ticket.id,
      performedBy,
      actor: AuditActor.USER,
    });
    return ticket;
  }

  async update(id: number, dto: UpdateTicketDto, performedBy: number): Promise<Ticket> {
    const ticket = await this.findOne(id);

    if (ticket.status === TicketStatus.DONE && dto.status && dto.status !== TicketStatus.DONE) {
      throw new BadRequestException('Cannot change status of a DONE ticket');
    }

    if (dto.status && dto.status !== ticket.status) {
      const allowed = ALLOWED_TRANSITIONS[ticket.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Transition from ${ticket.status} to ${dto.status} is not allowed`,
        );
      }
    }

    if (dto.version !== undefined && dto.version !== ticket.version) {
      throw new ConflictException('Ticket was modified by another request');
    }

    const { version: _v, ...rest } = dto;
    Object.assign(ticket, rest);

    if (dto.priority && dto.priority !== ticket.priority) {
      ticket.isOverdue = ticket.dueDate ? new Date(ticket.dueDate) < new Date() : false;
    }

    const updated = await this.ticketRepo.save(ticket);
    await this.auditLogsService.log({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.TICKET,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
    return updated;
  }

  async softDelete(id: number, performedBy: number): Promise<void> {
    await this.findOne(id);
    await this.ticketRepo.softDelete(id);
    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.TICKET,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
  }

  findDeleted(projectId: number): Promise<Ticket[]> {
    return this.ticketRepo.find({
      withDeleted: true,
      where: { projectId, deletedAt: Not(IsNull()) },
    });
  }

  async restore(id: number, performedBy: number): Promise<void> {
    const ticket = await this.ticketRepo.findOne({ where: { id }, withDeleted: true });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    await this.ticketRepo.restore(id);
    await this.auditLogsService.log({
      action: AuditAction.RESTORE,
      entityType: AuditEntityType.TICKET,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
  }

  async exportToCsv(projectId: number): Promise<string> {
    const tickets = await this.findAll(projectId);
    return ticketsToCsv(tickets);
  }

  async importFromCsv(
    buffer: Buffer,
    projectId: number,
    performedBy: number,
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    const rows = csvToRows(buffer.toString('utf-8'));
    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.title) throw new Error('title is required');
        if (!Object.values(TicketStatus).includes(row.status as TicketStatus))
          throw new Error(`invalid status: ${row.status}`);
        if (!Object.values(TicketPriority).includes(row.priority as TicketPriority))
          throw new Error(`invalid priority: ${row.priority}`);
        if (!Object.values(TicketType).includes(row.type as TicketType))
          throw new Error(`invalid type: ${row.type}`);

        const dto: CreateTicketDto = {
          title: row.title,
          description: row.description || undefined,
          status: row.status as TicketStatus,
          priority: row.priority as TicketPriority,
          type: row.type as TicketType,
          projectId,
          assigneeId: row.assigneeId ? Number(row.assigneeId) : undefined,
        };
        await this.create(dto, performedBy);
        created++;
      } catch (err: any) {
        failed++;
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return { created, failed, errors };
  }
}
