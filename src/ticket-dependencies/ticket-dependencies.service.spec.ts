import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TicketDependenciesService } from './ticket-dependencies.service';
import { TicketDependency } from '../entities/ticket-dependency.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketType } from '../common/enums/ticket-type.enum';

const mockTicket = (id: number, projectId = 1, status = TicketStatus.TODO): Partial<Ticket> => ({
  id, projectId, status,
  title: `Ticket ${id}`,
  priority: TicketPriority.MEDIUM,
  type: TicketType.BUG,
  version: 1,
});

describe('TicketDependenciesService', () => {
  let service: TicketDependenciesService;
  let depRepo: any;
  let ticketRepo: any;

  beforeEach(async () => {
    depRepo = {
      find: jest.fn(),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    ticketRepo = {
      findOneBy: jest.fn(),
      findByIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketDependenciesService,
        { provide: getRepositoryToken(TicketDependency), useValue: depRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
      ],
    }).compile();

    service = module.get<TicketDependenciesService>(TicketDependenciesService);
  });

  describe('findBlockers', () => {
    it('returns blockers for a ticket', async () => {
      const deps = [{ ticketId: 1, blockedById: 2 }];
      depRepo.find.mockResolvedValue(deps);
      expect(await service.findBlockers(1)).toBe(deps);
    });
  });

  describe('add', () => {
    it('adds a dependency between same-project tickets', async () => {
      ticketRepo.findOneBy
        .mockResolvedValueOnce(mockTicket(1))
        .mockResolvedValueOnce(mockTicket(2));
      depRepo.findBy.mockResolvedValue([]);
      depRepo.findOneBy.mockResolvedValue(null);
      const dep = { ticketId: 1, blockedById: 2 };
      depRepo.create.mockReturnValue(dep);
      depRepo.save.mockResolvedValue(dep);

      const result = await service.add(1, { blockedBy: 2 });
      expect(result).toBe(dep);
    });

    it('throws BadRequestException when ticket blocks itself', async () => {
      await expect(service.add(1, { blockedBy: 1 })).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when ticket not found', async () => {
      ticketRepo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.add(99, { blockedBy: 2 })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for cross-project tickets', async () => {
      ticketRepo.findOneBy
        .mockResolvedValueOnce(mockTicket(1, 1))
        .mockResolvedValueOnce(mockTicket(2, 2));
      await expect(service.add(1, { blockedBy: 2 })).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when dependency already exists', async () => {
      ticketRepo.findOneBy
        .mockResolvedValueOnce(mockTicket(1))
        .mockResolvedValueOnce(mockTicket(2));
      depRepo.findBy.mockResolvedValue([]);
      depRepo.findOneBy.mockResolvedValue({ ticketId: 1, blockedById: 2 });
      await expect(service.add(1, { blockedBy: 2 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('removes an existing dependency', async () => {
      depRepo.findOneBy.mockResolvedValue({ ticketId: 1, blockedById: 2 });
      depRepo.delete.mockResolvedValue(undefined);
      await service.remove(1, 2);
      expect(depRepo.delete).toHaveBeenCalledWith({ ticketId: 1, blockedById: 2 });
    });

    it('throws NotFoundException when dependency does not exist', async () => {
      depRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('hasUnresolvedBlockers', () => {
    it('returns false when no blockers', async () => {
      depRepo.findBy.mockResolvedValue([]);
      expect(await service.hasUnresolvedBlockers(1)).toBe(false);
    });

    it('returns true when a blocker is not DONE', async () => {
      depRepo.findBy.mockResolvedValue([{ ticketId: 1, blockedById: 2 }]);
      ticketRepo.findByIds.mockResolvedValue([mockTicket(2, 1, TicketStatus.IN_PROGRESS)]);
      expect(await service.hasUnresolvedBlockers(1)).toBe(true);
    });

    it('returns false when all blockers are DONE', async () => {
      depRepo.findBy.mockResolvedValue([{ ticketId: 1, blockedById: 2 }]);
      ticketRepo.findByIds.mockResolvedValue([mockTicket(2, 1, TicketStatus.DONE)]);
      expect(await service.hasUnresolvedBlockers(1)).toBe(false);
    });
  });

  describe('hasCircularDependency', () => {
    it('returns false when no existing dependencies', async () => {
      depRepo.findBy.mockResolvedValue([]);
      expect(await service.hasCircularDependency(1, 2)).toBe(false);
    });

    it('detects direct circular dependency: A blocked by B, adding B blocked by A', async () => {
      // Existing: ticket 2 is blocked by ticket 1 (ticketId=2, blockedById=1)
      depRepo.findBy.mockImplementation(({ ticketId }: { ticketId: number }) => {
        if (ticketId === 2) return Promise.resolve([{ ticketId: 2, blockedById: 1 }]);
        return Promise.resolve([]);
      });
      // We want to add: ticket 1 blocked by ticket 2 → circular
      expect(await service.hasCircularDependency(1, 2)).toBe(true);
    });

    it('detects transitive circular dependency', async () => {
      // Existing: 3 blocked by 2, 2 blocked by 1
      depRepo.findBy.mockImplementation(({ ticketId }: { ticketId: number }) => {
        if (ticketId === 3) return Promise.resolve([{ ticketId: 3, blockedById: 2 }]);
        if (ticketId === 2) return Promise.resolve([{ ticketId: 2, blockedById: 1 }]);
        return Promise.resolve([]);
      });
      // We want to add: ticket 1 blocked by ticket 3 → circular (1→3→2→1)
      expect(await service.hasCircularDependency(1, 3)).toBe(true);
    });

    it('returns false for non-circular chain', async () => {
      // Existing: 3 blocked by 2
      depRepo.findBy.mockImplementation(({ ticketId }: { ticketId: number }) => {
        if (ticketId === 3) return Promise.resolve([{ ticketId: 3, blockedById: 2 }]);
        return Promise.resolve([]);
      });
      // Adding: 2 blocked by 1 — no cycle
      expect(await service.hasCircularDependency(2, 1)).toBe(false);
    });
  });
});
