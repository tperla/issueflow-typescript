import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findAll(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async create(dto: CreateProjectDto, performedBy: number): Promise<Project> {
    const project = await this.projectRepo.save(this.projectRepo.create(dto));
    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.PROJECT,
      entityId: project.id,
      performedBy,
      actor: AuditActor.USER,
    });
    return project;
  }

  async update(id: number, dto: UpdateProjectDto, performedBy: number): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    const updated = await this.projectRepo.save(project);
    await this.auditLogsService.log({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.PROJECT,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
    return updated;
  }

  async softDelete(id: number, performedBy: number): Promise<void> {
    await this.findOne(id);
    await this.projectRepo.softDelete(id);
    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.PROJECT,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
  }

  findDeleted(): Promise<Project[]> {
    return this.projectRepo.find({ withDeleted: true, where: { deletedAt: Not(IsNull()) } });
  }

  async restore(id: number, performedBy: number): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id }, withDeleted: true });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    await this.projectRepo.restore(id);
    await this.auditLogsService.log({
      action: AuditAction.RESTORE,
      entityType: AuditEntityType.PROJECT,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
  }

  async getWorkload(id: number): Promise<{ userId: number; username: string; openTicketCount: number }[]> {
    await this.findOne(id);
    const rows = await this.ticketRepo
      .createQueryBuilder('t')
      .innerJoin('t.assignee', 'u')
      .select('u.id', 'userId')
      .addSelect('u.username', 'username')
      .addSelect('COUNT(t.id)', 'openTicketCount')
      .where('t.projectId = :id', { id })
      .andWhere('t.status != :done', { done: TicketStatus.DONE })
      .groupBy('u.id')
      .addGroupBy('u.username')
      .orderBy('COUNT(t.id)', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      userId: Number(r.userId),
      username: r.username,
      openTicketCount: Number(r.openTicketCount),
    }));
  }
}
