import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { TicketsModule } from './tickets/tickets.module';
import { CommentsModule } from './comments/comments.module';
import { TicketDependenciesModule } from './ticket-dependencies/ticket-dependencies.module';

@Module({
  imports: [TypeOrmModule.forRoot(typeOrmConfig), UsersModule, AuthModule, ProjectsModule, AuditLogsModule, TicketsModule, CommentsModule, TicketDependenciesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
