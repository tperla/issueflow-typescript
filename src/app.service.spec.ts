import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { UsersService } from './users/users.service';
import { UserRole } from './common/enums/user-role.enum';

const mockUsersService = {
  findByUsername: jest.fn(),
  create: jest.fn(),
};

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    jest.clearAllMocks();
  });

  it('seeds admin user when none exists', async () => {
    mockUsersService.findByUsername.mockResolvedValue(null);
    mockUsersService.create.mockResolvedValue({});

    await service.onApplicationBootstrap();

    expect(mockUsersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ADMIN }),
    );
  });

  it('skips seeding when admin already exists', async () => {
    mockUsersService.findByUsername.mockResolvedValue({ id: 1, username: 'admin' });

    await service.onApplicationBootstrap();

    expect(mockUsersService.create).not.toHaveBeenCalled();
  });

  it('silently ignores duplicate key error (concurrent startup race)', async () => {
    mockUsersService.findByUsername.mockResolvedValue(null);
    const dupError = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockUsersService.create.mockRejectedValue(dupError);

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('rethrows non-duplicate errors', async () => {
    mockUsersService.findByUsername.mockResolvedValue(null);
    mockUsersService.create.mockRejectedValue(new Error('connection lost'));

    await expect(service.onApplicationBootstrap()).rejects.toThrow('connection lost');
  });

  it('uses SEED_ADMIN_USERNAME env var when set', async () => {
    process.env.SEED_ADMIN_USERNAME = 'superadmin';
    mockUsersService.findByUsername.mockResolvedValue(null);
    mockUsersService.create.mockResolvedValue({});

    await service.onApplicationBootstrap();

    expect(mockUsersService.findByUsername).toHaveBeenCalledWith('superadmin');
    expect(mockUsersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'superadmin' }),
    );
    delete process.env.SEED_ADMIN_USERNAME;
  });
});
