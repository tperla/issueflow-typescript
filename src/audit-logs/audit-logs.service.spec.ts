import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';

const mockRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn() };

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<AuditLogsService>(AuditLogsService);
    jest.clearAllMocks();
  });

  it('creates and saves an audit log entry', async () => {
    const dto = {
      action: AuditAction.CREATE,
      entityType: AuditEntityType.PROJECT,
      entityId: 1,
      performedBy: 2,
      actor: AuditActor.USER,
    };
    mockRepo.create.mockReturnValue(dto);
    mockRepo.save.mockResolvedValue(dto);

    await service.log(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalledWith(dto);
  });

  describe('findAll', () => {
    it('returns all logs when no filters provided', async () => {
      const logs = [{ id: 1, action: AuditAction.CREATE }];
      mockRepo.find.mockResolvedValue(logs);
      const result = await service.findAll();
      expect(result).toBe(logs);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: {}, order: { timestamp: 'DESC' } });
    });

    it('filters by entityType', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll({ entityType: AuditEntityType.TICKET });
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { entityType: AuditEntityType.TICKET },
        order: { timestamp: 'DESC' },
      });
    });

    it('filters by action', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll({ action: AuditAction.DELETE });
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { action: AuditAction.DELETE },
        order: { timestamp: 'DESC' },
      });
    });

    it('filters by actor', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll({ actor: AuditActor.SYSTEM });
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { actor: AuditActor.SYSTEM },
        order: { timestamp: 'DESC' },
      });
    });

    it('filters by entityId', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll({ entityId: 5 });
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { entityId: 5 },
        order: { timestamp: 'DESC' },
      });
    });

    it('combines multiple filters', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll({ entityType: AuditEntityType.PROJECT, action: AuditAction.UPDATE });
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { entityType: AuditEntityType.PROJECT, action: AuditAction.UPDATE },
        order: { timestamp: 'DESC' },
      });
    });
  });
});
