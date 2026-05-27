import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { TicketType } from '../common/enums/ticket-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

const makeTicket = (id: number, priority: TicketPriority, projectId = 1): Partial<Ticket> => ({
  id, priority, projectId,
  status: TicketStatus.TODO,
  type: TicketType.BUG,
  title: `T${id}`,
  assigneeId: null,
  dueDate: new Date('2020-01-01'),
  isOverdue: false,
  version: 1,
});

const makeUser = (id: number, createdAt = new Date()): Partial<User> => ({
  id, username: `dev${id}`, role: UserRole.DEVELOPER, createdAt,
});

describe('SchedulerService', () => {
  let service: SchedulerService;
  let ticketRepo: any;
  let userRepo: any;
  let auditLogsService: any;

  const qbMock: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ticketRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = { createQueryBuilder: jest.fn().mockReturnValue(qbMock) };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  describe('runEscalation', () => {
    it('bumps LOW to MEDIUM and does not set isOverdue', async () => {
      const ticket = makeTicket(1, TicketPriority.LOW);
      qbMock.getMany.mockResolvedValue([ticket]);
      ticketRepo.save.mockResolvedValue(ticket);

      await service.runEscalation();

      expect(ticketRepo.save).toHaveBeenCalledWith(expect.objectContaining({ priority: TicketPriority.MEDIUM, isOverdue: false }));
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('bumps MEDIUM to HIGH', async () => {
      const ticket = makeTicket(1, TicketPriority.MEDIUM);
      qbMock.getMany.mockResolvedValue([ticket]);
      ticketRepo.save.mockResolvedValue(ticket);

      await service.runEscalation();

      expect(ticketRepo.save).toHaveBeenCalledWith(expect.objectContaining({ priority: TicketPriority.HIGH }));
    });

    it('bumps HIGH to CRITICAL and sets isOverdue = true', async () => {
      const ticket = makeTicket(1, TicketPriority.HIGH);
      qbMock.getMany.mockResolvedValue([ticket]);
      ticketRepo.save.mockResolvedValue(ticket);

      await service.runEscalation();

      expect(ticketRepo.save).toHaveBeenCalledWith(expect.objectContaining({ priority: TicketPriority.CRITICAL, isOverdue: true }));
    });

    it('is idempotent — does not escalate CRITICAL tickets (excluded by query)', async () => {
      qbMock.getMany.mockResolvedValue([]);

      await service.runEscalation();

      expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it('does nothing when no overdue tickets found', async () => {
      qbMock.getMany.mockResolvedValue([]);
      await service.runEscalation();
      expect(auditLogsService.log).not.toHaveBeenCalled();
    });

    it('processes multiple tickets in one run', async () => {
      const tickets = [makeTicket(1, TicketPriority.LOW), makeTicket(2, TicketPriority.MEDIUM)];
      qbMock.getMany.mockResolvedValue(tickets);
      ticketRepo.save.mockResolvedValue({});

      await service.runEscalation();

      expect(ticketRepo.save).toHaveBeenCalledTimes(2);
      expect(auditLogsService.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('autoAssign', () => {
    it('skips assignment when ticket already has assigneeId', async () => {
      const ticket = { ...makeTicket(1, TicketPriority.LOW), assigneeId: 5 } as Ticket;
      await service.autoAssign(ticket);
      expect(ticketRepo.update).not.toHaveBeenCalled();
    });

    it('does nothing when no DEVELOPER users exist', async () => {
      const ticket = makeTicket(1, TicketPriority.LOW) as Ticket;
      qbMock.getMany.mockResolvedValue([]);
      await service.autoAssign(ticket);
      expect(ticketRepo.update).not.toHaveBeenCalled();
    });

    it('assigns to the only available developer', async () => {
      const ticket = makeTicket(1, TicketPriority.LOW) as Ticket;
      const dev = makeUser(10);
      qbMock.getMany.mockResolvedValue([dev]);
      qbMock.getRawMany.mockResolvedValue([]);

      await service.autoAssign(ticket);

      expect(ticketRepo.update).toHaveBeenCalledWith(ticket.id, { assigneeId: 10 });
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('assigns to the least-loaded developer', async () => {
      const ticket = makeTicket(1, TicketPriority.LOW) as Ticket;
      const dev10 = makeUser(10);
      const dev11 = makeUser(11);
      qbMock.getMany.mockResolvedValue([dev10, dev11]);
      // dev10 has 3 open tickets, dev11 has 1
      qbMock.getRawMany.mockResolvedValue([
        { assigneeId: 10, cnt: '3' },
        { assigneeId: 11, cnt: '1' },
      ]);

      await service.autoAssign(ticket);

      expect(ticketRepo.update).toHaveBeenCalledWith(ticket.id, { assigneeId: 11 });
    });

    it('breaks ties by oldest registration (first in ordered list)', async () => {
      const ticket = makeTicket(1, TicketPriority.LOW) as Ticket;
      const older = makeUser(10, new Date('2023-01-01'));
      const newer = makeUser(11, new Date('2024-01-01'));
      qbMock.getMany.mockResolvedValue([older, newer]); // ordered by createdAt ASC
      qbMock.getRawMany.mockResolvedValue([]); // both have 0 tickets

      await service.autoAssign(ticket);

      expect(ticketRepo.update).toHaveBeenCalledWith(ticket.id, { assigneeId: 10 });
    });
  });
});
