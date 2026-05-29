import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Comment } from '../entities/comment.entity';
import { User } from '../entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { extractMentions } from './helpers/mention-parser.helper';
import { UserRole } from '../common/enums/user-role.enum';

const mockUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: 'alice',
  email: 'alice@test.com',
  fullName: 'Alice',
  role: UserRole.DEVELOPER,
  passwordHash: 'hash',
  createdAt: new Date(),
  ...overrides,
});

const mockComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 1,
  ticketId: 10,
  authorId: 1,
  content: 'Hello',
  mentionedUsers: [],
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ticket: null,
  author: null,
  ...overrides,
});

describe('extractMentions helper', () => {
  it('extracts @mentions from content', () => {
    expect(extractMentions('Hello @Alice and @Bob')).toEqual(['alice', 'bob']);
  });

  it('is case-insensitive and deduplicates', () => {
    expect(extractMentions('@Alice @alice @ALICE')).toEqual(['alice']);
  });

  it('returns empty array when no mentions', () => {
    expect(extractMentions('No mentions here')).toEqual([]);
  });

  it('ignores non-word characters after @', () => {
    expect(extractMentions('email@domain.com')).toEqual(['domain']);
  });
});

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepo: any;
  let userRepo: any;
  let auditLogsService: any;

  const qbMock = {
    where: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    commentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };
    userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('findByTicket', () => {
    it('returns comments for ticket', async () => {
      const comments = [mockComment()];
      commentRepo.find.mockResolvedValue(comments);
      expect(await service.findByTicket(10)).toBe(comments);
      expect(commentRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { ticketId: 10 } }));
    });
  });

  describe('findOne', () => {
    it('returns comment when found', async () => {
      const comment = mockComment();
      commentRepo.findOne.mockResolvedValue(comment);
      expect(await service.findOne(1)).toBe(comment);
    });

    it('throws NotFoundException when not found', async () => {
      commentRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates comment with resolved mentions and logs audit', async () => {
      const alice = mockUser();
      qbMock.getMany.mockResolvedValue([alice]);
      const comment = mockComment({ mentionedUsers: [alice] });
      commentRepo.create.mockReturnValue(comment);
      commentRepo.save.mockResolvedValue(comment);
      commentRepo.findOne.mockResolvedValue(comment);

      const result = await service.create(10, { content: 'Hello @alice' }, 2);
      expect(result).toBe(comment);
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('creates comment with no mentions', async () => {
      qbMock.getMany.mockResolvedValue([]);
      const comment = mockComment();
      commentRepo.create.mockReturnValue(comment);
      commentRepo.save.mockResolvedValue(comment);
      commentRepo.findOne.mockResolvedValue(comment);

      await service.create(10, { content: 'Hello world' }, 2);
      expect(commentRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates content and mentions, logs audit', async () => {
      const comment = mockComment({ version: 1 });
      commentRepo.findOne.mockResolvedValue(comment);
      qbMock.getMany.mockResolvedValue([]);
      commentRepo.save.mockResolvedValue({ ...comment, content: 'Updated' });

      await service.update(1, { content: 'Updated', version: 1 }, 2);
      expect(commentRepo.save).toHaveBeenCalled();
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('throws ConflictException on version mismatch', async () => {
      const comment = mockComment({ version: 2 });
      commentRepo.findOne.mockResolvedValue(comment);
      await expect(service.update(1, { content: 'x', version: 1 }, 2)).rejects.toThrow(ConflictException);
    });

    it('updates without version check when version not provided', async () => {
      const comment = mockComment({ version: 5 });
      commentRepo.findOne.mockResolvedValue(comment);
      qbMock.getMany.mockResolvedValue([]);
      commentRepo.save.mockResolvedValue(comment);

      await service.update(1, { content: 'New content' }, 2);
      expect(commentRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes comment and logs audit', async () => {
      const comment = mockComment();
      commentRepo.findOne.mockResolvedValue(comment);
      commentRepo.delete.mockResolvedValue(undefined);

      await service.remove(1, 2);
      expect(commentRepo.delete).toHaveBeenCalledWith(1);
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when comment does not exist', async () => {
      commentRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(99, 2)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMentionsByUser', () => {
    it('returns paginated comments mentioning the user', async () => {
      const comments = [mockComment()];
      qbMock.getManyAndCount.mockResolvedValue([comments, 1]);
      const result = await service.findMentionsByUser(1, 1, 20);
      expect(result).toEqual({ data: comments, total: 1, page: 1 });
    });
  });
});
