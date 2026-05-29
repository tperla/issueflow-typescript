import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketDependency } from '../entities/ticket-dependency.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { AddDependencyDto } from './dto/add-dependency.dto';

@Injectable()
export class TicketDependenciesService {
  constructor(
    @InjectRepository(TicketDependency) private readonly depRepo: Repository<TicketDependency>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async findBlockers(ticketId: number): Promise<TicketDependency[]> {
    return this.depRepo.find({
      where: { ticketId },
      relations: ['blockedBy'],
    });
  }

  async add(ticketId: number, dto: AddDependencyDto): Promise<TicketDependency> {
    const blockerId = dto.blockedBy;

    if (ticketId === blockerId) {
      throw new BadRequestException('A ticket cannot block itself');
    }

    const [ticket, blocker] = await Promise.all([
      this.ticketRepo.findOneBy({ id: ticketId }),
      this.ticketRepo.findOneBy({ id: blockerId }),
    ]);

    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
    if (!blocker) throw new NotFoundException(`Ticket ${blockerId} not found`);

    if (ticket.projectId !== blocker.projectId) {
      throw new BadRequestException('Both tickets must belong to the same project');
    }

    if (await this.hasCircularDependency(ticketId, blockerId)) {
      throw new ConflictException('Adding this dependency would create a circular dependency');
    }

    const existing = await this.depRepo.findOneBy({ ticketId, blockedById: blockerId });
    if (existing) throw new BadRequestException('Dependency already exists');

    return this.depRepo.save(this.depRepo.create({ ticketId, blockedById: blockerId }));
  }

  async remove(ticketId: number, blockerId: number): Promise<void> {
    const dep = await this.depRepo.findOneBy({ ticketId, blockedById: blockerId });
    if (!dep) throw new NotFoundException('Dependency not found');
    await this.depRepo.delete({ ticketId, blockedById: blockerId });
  }

  async hasUnresolvedBlockers(ticketId: number): Promise<boolean> {
    const deps = await this.depRepo.findBy({ ticketId });
    if (deps.length === 0) return false;
    const blockerIds = deps.map(d => d.blockedById);
    const blockers = await this.ticketRepo.findByIds(blockerIds);
    return blockers.some(b => b.status !== TicketStatus.DONE);
  }

  async hasCircularDependency(ticketId: number, blockerId: number): Promise<boolean> {
    const visited = new Set<number>();
    const queue = [blockerId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === ticketId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const deps = await this.depRepo.findBy({ ticketId: current });
      for (const dep of deps) {
        queue.push(dep.blockedById);
      }
    }
    return false;
  }
}
