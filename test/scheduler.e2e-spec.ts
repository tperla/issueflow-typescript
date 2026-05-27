import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { SchedulerService } from './../src/scheduler/scheduler.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Ticket } from './../src/entities/ticket.entity';
import { Repository } from 'typeorm';

describe('Scheduler (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let devId: number;
  let projectId: number;
  let schedulerService: SchedulerService;
  let ticketRepo: Repository<Ticket>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    schedulerService = app.get(SchedulerService);
    ticketRepo = app.get(getRepositoryToken(Ticket));

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.accessToken;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    adminId = me.body.id;

    // Create a developer for auto-assignment tests
    const devRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'sched_dev', email: 'sched_dev@test.com', fullName: 'Sched Dev', role: 'DEVELOPER', password: 'dev123' });
    devId = devRes.body.id;

    const proj = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Scheduler Test Project', description: 'e2e', ownerId: adminId });
    projectId = proj.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Escalation', () => {
    it('bumps LOW priority on overdue ticket to MEDIUM', async () => {
      const ticket = await ticketRepo.save(ticketRepo.create({
        title: 'Overdue LOW',
        status: 'TODO' as any,
        priority: 'LOW' as any,
        type: 'BUG' as any,
        projectId,
        dueDate: new Date('2020-01-01'),
        isOverdue: false,
      }));

      await schedulerService.runEscalation();

      const updated = await ticketRepo.findOneBy({ id: ticket.id });
      expect(updated.priority).toBe('MEDIUM');
      expect(updated.isOverdue).toBe(false);
    });

    it('bumps HIGH priority to CRITICAL and sets isOverdue = true', async () => {
      const ticket = await ticketRepo.save(ticketRepo.create({
        title: 'Overdue HIGH',
        status: 'TODO' as any,
        priority: 'HIGH' as any,
        type: 'BUG' as any,
        projectId,
        dueDate: new Date('2020-01-01'),
        isOverdue: false,
      }));

      await schedulerService.runEscalation();

      const updated = await ticketRepo.findOneBy({ id: ticket.id });
      expect(updated.priority).toBe('CRITICAL');
      expect(updated.isOverdue).toBe(true);
    });

    it('does not escalate CRITICAL tickets', async () => {
      const ticket = await ticketRepo.save(ticketRepo.create({
        title: 'Already CRITICAL',
        status: 'TODO' as any,
        priority: 'CRITICAL' as any,
        type: 'BUG' as any,
        projectId,
        dueDate: new Date('2020-01-01'),
        isOverdue: true,
      }));

      await schedulerService.runEscalation();

      const updated = await ticketRepo.findOneBy({ id: ticket.id });
      expect(updated.priority).toBe('CRITICAL');
    });

    it('does not escalate tickets without dueDate', async () => {
      const ticket = await ticketRepo.save(ticketRepo.create({
        title: 'No due date',
        status: 'TODO' as any,
        priority: 'LOW' as any,
        type: 'BUG' as any,
        projectId,
      }));

      await schedulerService.runEscalation();

      const updated = await ticketRepo.findOneBy({ id: ticket.id });
      expect(updated.priority).toBe('LOW');
    });

    it('clears isOverdue when priority is manually changed via PATCH', async () => {
      const ticket = await ticketRepo.save(ticketRepo.create({
        title: 'Manual priority change',
        status: 'TODO' as any,
        priority: 'CRITICAL' as any,
        type: 'BUG' as any,
        projectId,
        dueDate: new Date('2020-01-01'),
        isOverdue: true,
      }));

      const res = await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'HIGH' })
        .expect(200);

      expect(res.body.isOverdue).toBe(false);
    });
  });

  describe('Auto-assignment', () => {
    it('auto-assigns ticket to a developer when no assigneeId provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Auto assign me', status: 'TODO', priority: 'LOW', type: 'FEATURE', projectId })
        .expect(201);

      // Some developer should be assigned (DB has other devs from prior suites; we verify assignment happened)
      expect(res.body.assigneeId).not.toBeNull();
    });

    it('does not override explicit assigneeId on create', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Manual assign', status: 'TODO', priority: 'LOW', type: 'FEATURE', projectId, assigneeId: adminId })
        .expect(201);

      expect(res.body.assigneeId).toBe(adminId);
    });

    it('audit log contains AUTO_ASSIGN entry for auto-assigned ticket', async () => {
      const ticket = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Audit assign', status: 'TODO', priority: 'LOW', type: 'BUG', projectId })
        .expect(201);

      const logs = await request(app.getHttpServer())
        .get(`/audit-logs?entityId=${ticket.body.id}&entityType=TICKET`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const autoAssignLog = logs.body.find((l: any) => l.action === 'AUTO_ASSIGN');
      expect(autoAssignLog).toBeDefined();
      expect(autoAssignLog.actor).toBe('SYSTEM');
    });
  });
});
