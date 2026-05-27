import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { Attachment } from '../entities/attachment.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const mockFile = (mimetype = 'image/png'): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'test.png',
  encoding: '7bit',
  mimetype,
  buffer: Buffer.from('fake-image-data'),
  size: 100,
  stream: null,
  destination: '',
  filename: '',
  path: '',
});

const mockAttachment = (overrides = {}): Attachment => ({
  id: 1,
  ticketId: 10,
  filename: 'test.png',
  contentType: 'image/png',
  data: Buffer.from('fake'),
  createdAt: new Date(),
  ticket: null,
  ...overrides,
});

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let attachmentRepo: any;
  let auditLogsService: any;

  beforeEach(async () => {
    attachmentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      delete: jest.fn(),
    };
    auditLogsService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('upload', () => {
    it('saves attachment and returns metadata without data field', async () => {
      const attachment = mockAttachment();
      attachmentRepo.create.mockReturnValue(attachment);
      attachmentRepo.save.mockResolvedValue(attachment);

      const result = await service.upload(10, mockFile(), 1);

      expect(result).not.toHaveProperty('data');
      expect(result).toMatchObject({ id: 1, ticketId: 10, filename: 'test.png', contentType: 'image/png' });
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('throws UnsupportedMediaTypeException for disallowed MIME type', async () => {
      await expect(
        service.upload(10, mockFile('application/x-executable'), 1),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('accepts all allowed MIME types', async () => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/zip'];
      for (const mime of allowed) {
        const attachment = mockAttachment({ contentType: mime });
        attachmentRepo.create.mockReturnValue(attachment);
        attachmentRepo.save.mockResolvedValue(attachment);
        await expect(service.upload(10, mockFile(mime), 1)).resolves.not.toThrow();
      }
    });
  });

  describe('remove', () => {
    it('deletes attachment and logs audit', async () => {
      attachmentRepo.findOneBy.mockResolvedValue(mockAttachment());
      attachmentRepo.delete.mockResolvedValue(undefined);

      await service.remove(10, 1, 2);

      expect(attachmentRepo.delete).toHaveBeenCalledWith(1);
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when attachment not found', async () => {
      attachmentRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove(10, 99, 2)).rejects.toThrow(NotFoundException);
    });
  });
});
