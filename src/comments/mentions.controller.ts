import { Controller, Get, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users/:userId/mentions')
export class MentionsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findMentions(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.commentsService.findMentionsByUser(userId, Number(page), Number(pageSize));
  }
}
