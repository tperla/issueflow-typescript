import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

const mockUser: User = {
  id: 1,
  username: 'john',
  email: 'john@example.com',
  fullName: 'John Doe',
  role: UserRole.DEVELOPER,
  passwordHash: 'hashed',
  createdAt: new Date(),
};

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOneBy: jest.fn(),
  delete: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('hashes password and saves user', async () => {
      mockRepo.create.mockImplementation((data) => ({ ...data }));
      mockRepo.save.mockResolvedValue(mockUser);

      await service.create({
        username: 'john',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: UserRole.DEVELOPER,
        password: 'plaintext',
      });

      const created = mockRepo.create.mock.calls[0][0];
      expect(created.password).toBeUndefined();
      expect(await bcrypt.compare('plaintext', created.passwordHash)).toBe(true);
    });
  });

  describe('findAll', () => {
    it('returns all users', async () => {
      mockRepo.find.mockResolvedValue([mockUser]);
      expect(await service.findAll()).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('returns user when found', async () => {
      mockRepo.findOneBy.mockResolvedValue(mockUser);
      expect(await service.findOne(1)).toEqual(mockUser);
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUsername', () => {
    it('returns user when found', async () => {
      mockRepo.findOneBy.mockResolvedValue(mockUser);
      expect(await service.findByUsername('john')).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      expect(await service.findByUsername('nobody')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates and returns user', async () => {
      const updated = { ...mockUser, fullName: 'Jane Doe' };
      mockRepo.findOneBy.mockResolvedValue({ ...mockUser });
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, { fullName: 'Jane Doe' });
      expect(result.fullName).toBe('Jane Doe');
    });

    it('throws NotFoundException for unknown id', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update(999, { fullName: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes user', async () => {
      mockRepo.findOneBy.mockResolvedValue(mockUser);
      mockRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(mockRepo.delete).toHaveBeenCalledWith(1);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
