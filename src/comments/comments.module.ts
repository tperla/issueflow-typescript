import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../entities/comment.entity';
import { User } from '../entities/user.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { MentionsController } from './mentions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, User]), AuditLogsModule],
  providers: [CommentsService],
  controllers: [CommentsController, MentionsController],
})
export class CommentsModule {}
