import {
  Controller, Get, Post, Delete,
  Param, Body, ParseIntPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TicketDependenciesService } from './ticket-dependencies.service';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('tickets/:ticketId/dependencies')
export class TicketDependenciesController {
  constructor(private readonly ticketDependenciesService: TicketDependenciesService) {}

  @Get()
  findBlockers(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.ticketDependenciesService.findBlockers(ticketId);
  }

  @Post()
  add(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: AddDependencyDto,
  ) {
    return this.ticketDependenciesService.add(ticketId, dto);
  }

  @Delete(':blockerId')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('blockerId', ParseIntPipe) blockerId: number,
  ) {
    return this.ticketDependenciesService.remove(ticketId, blockerId);
  }
}
