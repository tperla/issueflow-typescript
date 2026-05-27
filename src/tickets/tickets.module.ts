import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Ticket } from '../entities/ticket.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TicketDependenciesModule } from '../ticket-dependencies/ticket-dependencies.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
    MulterModule.register({ storage: undefined }),
    AuditLogsModule,
    forwardRef(() => TicketDependenciesModule),
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
