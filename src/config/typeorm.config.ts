import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { Ticket } from '../entities/ticket.entity';
import { Comment } from '../entities/comment.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { TicketDependency } from '../entities/ticket-dependency.entity';
import { Attachment } from '../entities/attachment.entity';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER ?? 'issueflow',
  password: process.env.DB_PASSWORD ?? 'issueflow',
  database: process.env.DB_NAME ?? 'issueflow',
  entities: [User, Project, Ticket, Comment, AuditLog, TicketDependency, Attachment],
  synchronize: true,
};
