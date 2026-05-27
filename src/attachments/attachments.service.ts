import { Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from '../entities/attachment.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';
import { ALLOWED_MIME_TYPES } from './multer.config';

type AttachmentMeta = Omit<Attachment, 'data'>;

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment) private readonly attachmentRepo: Repository<Attachment>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async upload(
    ticketId: number,
    file: Express.Multer.File,
    performedBy: number,
  ): Promise<AttachmentMeta> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(`File type '${file.mimetype}' is not allowed`);
    }

    const saved = await this.attachmentRepo.save(
      this.attachmentRepo.create({
        ticketId,
        filename: file.originalname,
        contentType: file.mimetype,
        data: file.buffer,
      }),
    );

    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.ATTACHMENT,
      entityId: saved.id,
      performedBy,
      actor: AuditActor.USER,
    });

    const { data: _data, ...meta } = saved;
    return meta;
  }

  async remove(ticketId: number, attachmentId: number, performedBy: number): Promise<void> {
    const attachment = await this.attachmentRepo.findOneBy({ id: attachmentId, ticketId });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);

    await this.attachmentRepo.delete(attachmentId);

    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.ATTACHMENT,
      entityId: attachmentId,
      performedBy,
      actor: AuditActor.USER,
    });
  }
}
