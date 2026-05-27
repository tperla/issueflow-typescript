import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketDependency } from '../entities/ticket-dependency.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketDependenciesService } from './ticket-dependencies.service';
import { TicketDependenciesController } from './ticket-dependencies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TicketDependency, Ticket])],
  providers: [TicketDependenciesService],
  controllers: [TicketDependenciesController],
  exports: [TicketDependenciesService],
})
export class TicketDependenciesModule {}
