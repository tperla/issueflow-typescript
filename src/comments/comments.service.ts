import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { User } from '../entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditActor } from '../common/enums/audit-actor.enum';
import { AuditEntityType } from '../common/enums/audit-entity-type.enum';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { extractMentions } from './helpers/mention-parser.helper';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findByTicket(ticketId: number): Promise<Comment[]> {
    return this.commentRepo.find({
      where: { ticketId },
      relations: ['author', 'mentionedUsers'],
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Comment> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: ['author', 'mentionedUsers'],
    });
    if (!comment) throw new NotFoundException(`Comment ${id} not found`);
    return comment;
  }

  async findMentionsByUser(userId: number): Promise<Comment[]> {
    return this.commentRepo
      .createQueryBuilder('c')
      .innerJoin('c.mentionedUsers', 'u', 'u.id = :userId', { userId })
      .leftJoinAndSelect('c.mentionedUsers', 'mu')
      .leftJoinAndSelect('c.author', 'a')
      .orderBy('c.createdAt', 'ASC')
      .getMany();
  }

  async create(ticketId: number, dto: CreateCommentDto, authorId: number): Promise<Comment> {
    const mentionedUsers = await this.resolveMentions(dto.content);
    const comment = await this.commentRepo.save(
      this.commentRepo.create({ ticketId, authorId, content: dto.content, mentionedUsers }),
    );
    await this.auditLogsService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.COMMENT,
      entityId: comment.id,
      performedBy: authorId,
      actor: AuditActor.USER,
    });
    return this.findOne(comment.id);
  }

  async update(id: number, dto: UpdateCommentDto, performedBy: number): Promise<Comment> {
    const comment = await this.findOne(id);

    if (dto.version !== undefined && dto.version !== comment.version) {
      throw new ConflictException('Comment was modified by another request');
    }

    comment.content = dto.content;
    comment.mentionedUsers = await this.resolveMentions(dto.content);
    await this.commentRepo.save(comment);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.COMMENT,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
    return this.findOne(id);
  }

  async remove(id: number, performedBy: number): Promise<void> {
    await this.findOne(id);
    await this.commentRepo.delete(id);
    await this.auditLogsService.log({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.COMMENT,
      entityId: id,
      performedBy,
      actor: AuditActor.USER,
    });
  }

  private async resolveMentions(content: string): Promise<User[]> {
    const usernames = extractMentions(content);
    if (usernames.length === 0) return [];
    return this.userRepo
      .createQueryBuilder('u')
      .where('lower(u.username) IN (:...usernames)', { usernames })
      .getMany();
  }
}
