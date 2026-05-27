import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket } from '../entities/ticket.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TicketDependenciesService } from '../ticket-dependencies/ticket-dependencies.service';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketType } from '../common/enums/ticket-type.enum';

const mockTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  title: 'Bug fix',
  description: '',
  status: TicketStatus.TODO,
  priority: TicketPriority.MEDIUM,
  type: TicketType.BUG,
  projectId: 1,
  assigneeId: null,
  dueDate: null,
  isOverdue: false,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  project: null,
  assignee: null,
  ...overrides,
});

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketRepo: any;
  let auditLogsService: any;
  let ticketDependenciesService: any;

  beforeEach(async () => {
    ticketRepo = {
      findBy: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      find: jest.fn(),
    };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };
    ticketDependenciesService = { hasUnresolvedBlockers: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: TicketDependenciesService, useValue: ticketDependenciesService },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('findAll', () => {
    it('returns tickets for project', async () => {
      const tickets = [mockTicket()];
      ticketRepo.findBy.mockResolvedValue(tickets);
      expect(await service.findAll(1)).toBe(tickets);
      expect(ticketRepo.findBy).toHaveBeenCalledWith({ projectId: 1 });
    });
  });

  describe('findOne', () => {
    it('returns ticket when found', async () => {
      const ticket = mockTicket();
      ticketRepo.findOneBy.mockResolvedValue(ticket);
      expect(await service.findOne(1)).toBe(ticket);
    });

    it('throws NotFoundException when not found', async () => {
      ticketRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a ticket and logs audit', async () => {
      const dto = {
        title: 'New bug',
        status: TicketStatus.TODO,
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: 1,
      };
      const ticket = mockTicket({ title: 'New bug' });
      ticketRepo.create.mockReturnValue(ticket);
      ticketRepo.save.mockResolvedValue(ticket);

      const result = await service.create(dto, 5);
      expect(result).toBe(ticket);
      expect(auditLogsService.log).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates ticket and logs audit', async () => {
      const ticket = mockTicket({ status: TicketStatus.TODO });
      ticketRepo.findOneBy.mockResolvedValue(ticket);
      ticketRepo.save.mockResolvedValue({ ...ticket, title: 'Updated' });

      const result = await service.update(1, { title: 'Updated', version: 1 }, 5);
      expect(result.title).toBe('Updated');
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('throws BadRequestException when changing status of DONE ticket', async () => {
      const ticket = mockTicket({ status: TicketStatus.DONE });
      ticketRepo.findOneBy.mockResolvedValue(ticket);
      await expect(service.update(1, { status: TicketStatus.TODO }, 5)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on invalid status transition', async () => {
      const ticket = mockTicket({ status: TicketStatus.TODO });
      ticketRepo.findOneBy.mockResolvedValue(ticket);
      await expect(service.update(1, { status: TicketStatus.DONE }, 5)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on version mismatch', async () => {
      const ticket = mockTicket({ version: 2 });
      ticketRepo.findOneBy.mockResolvedValue(ticket);
      await expect(service.update(1, { title: 'x', version: 1 }, 5)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when transitioning to DONE with unresolved blockers', async () => {
      const ticket = mockTicket({ status: TicketStatus.IN_REVIEW });
      ticketRepo.findOneBy.mockResolvedValue(ticket);
      ticketDependenciesService.hasUnresolvedBlockers.mockResolvedValue(true);
      await expect(service.update(1, { status: TicketStatus.DONE }, 5)).rejects.toThrow(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes ticket and logs audit', async () => {
      const ticket = mockTicket();
      ticketRepo.findOneBy.mockResolvedValue(ticket);
      ticketRepo.softDelete.mockResolvedValue(undefined);

      await service.softDelete(1, 5);
      expect(ticketRepo.softDelete).toHaveBeenCalledWith(1);
      expect(auditLogsService.log).toHaveBeenCalled();
    });
  });

  describe('findDeleted', () => {
    it('returns deleted tickets for project', async () => {
      const tickets = [mockTicket({ deletedAt: new Date() })];
      ticketRepo.find.mockResolvedValue(tickets);
      expect(await service.findDeleted(1)).toBe(tickets);
    });
  });

  describe('restore', () => {
    it('restores ticket and logs audit', async () => {
      const ticket = mockTicket({ deletedAt: new Date() });
      ticketRepo.findOne.mockResolvedValue(ticket);
      ticketRepo.restore.mockResolvedValue(undefined);

      await service.restore(1, 5);
      expect(ticketRepo.restore).toHaveBeenCalledWith(1);
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when ticket does not exist', async () => {
      ticketRepo.findOne.mockResolvedValue(null);
      await expect(service.restore(99, 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportToCsv', () => {
    it('returns csv string', async () => {
      ticketRepo.findBy.mockResolvedValue([mockTicket()]);
      const csv = await service.exportToCsv(1);
      expect(typeof csv).toBe('string');
      expect(csv).toContain('title');
    });
  });

  describe('importFromCsv', () => {
    it('returns created/failed counts', async () => {
      const csv = 'title,description,status,priority,type,assigneeId\nBug,desc,TODO,MEDIUM,BUG,\n';
      ticketRepo.create.mockReturnValue(mockTicket());
      ticketRepo.save.mockResolvedValue(mockTicket());

      const result = await service.importFromCsv(Buffer.from(csv), 1, 5);
      expect(result.created).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('records failure for invalid row', async () => {
      const csv = 'title,description,status,priority,type,assigneeId\n,desc,INVALID,MEDIUM,BUG,\n';
      const result = await service.importFromCsv(Buffer.from(csv), 1, 5);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });
  });
});
