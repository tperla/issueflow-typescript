import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from '../entities/project.entity';
import { Ticket } from '../entities/ticket.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const mockProject: Partial<Project> = { id: 1, name: 'Alpha', description: 'desc', ownerId: 1, deletedAt: null };

const mockProjectRepo = {
  find: jest.fn(),
  findOneBy: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  softDelete: jest.fn(),
  restore: jest.fn(),
};
const mockTicketRepo = { createQueryBuilder: jest.fn() };
const mockAuditLogsService = { log: jest.fn() };

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: getRepositoryToken(Ticket), useValue: mockTicketRepo },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
      ],
    }).compile();
    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
    mockAuditLogsService.log.mockResolvedValue(undefined);
  });

  describe('findAll', () => {
    it('returns all projects', async () => {
      mockProjectRepo.find.mockResolvedValue([mockProject]);
      expect(await service.findAll()).toEqual([mockProject]);
    });
  });

  describe('findOne', () => {
    it('returns project when found', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue(mockProject);
      expect(await service.findOne(1)).toEqual(mockProject);
    });

    it('throws NotFoundException when not found', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('saves project and logs audit entry', async () => {
      mockProjectRepo.create.mockReturnValue(mockProject);
      mockProjectRepo.save.mockResolvedValue(mockProject);

      const result = await service.create({ name: 'Alpha', ownerId: 1 }, 1);
      expect(result).toEqual(mockProject);
      expect(mockAuditLogsService.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('updates project and logs audit entry', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue({ ...mockProject });
      mockProjectRepo.save.mockResolvedValue({ ...mockProject, name: 'Beta' });

      const result = await service.update(1, { name: 'Beta' }, 1);
      expect(result.name).toBe('Beta');
      expect(mockAuditLogsService.log).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update(99, { name: 'X' }, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes project and logs audit entry', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue(mockProject);
      mockProjectRepo.softDelete.mockResolvedValue({});

      await service.softDelete(1, 1);
      expect(mockProjectRepo.softDelete).toHaveBeenCalledWith(1);
      expect(mockAuditLogsService.log).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue(null);
      await expect(service.softDelete(99, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('restores deleted project and logs audit entry', async () => {
      mockProjectRepo.findOne.mockResolvedValue(mockProject);
      mockProjectRepo.restore.mockResolvedValue({});

      await service.restore(1, 1);
      expect(mockProjectRepo.restore).toHaveBeenCalledWith(1);
      expect(mockAuditLogsService.log).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockProjectRepo.findOne.mockResolvedValue(null);
      await expect(service.restore(99, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWorkload', () => {
    it('returns workload data sorted by openTicketCount', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue(mockProject);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { userId: '2', username: 'alice', openTicketCount: '1' },
          { userId: '3', username: 'bob', openTicketCount: '3' },
        ]),
      };
      mockTicketRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getWorkload(1);
      expect(result).toEqual([
        { userId: 2, username: 'alice', openTicketCount: 1 },
        { userId: 3, username: 'bob', openTicketCount: 3 },
      ]);
    });
  });
});
