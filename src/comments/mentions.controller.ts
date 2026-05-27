import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users/:userId/mentions')
export class MentionsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findMentions(@Param('userId', ParseIntPipe) userId: number) {
    return this.commentsService.findMentionsByUser(userId);
  }
}
