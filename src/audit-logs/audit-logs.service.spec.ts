import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';

const mockRepo = { create: jest.fn(), save: jest.fn() };

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
});
