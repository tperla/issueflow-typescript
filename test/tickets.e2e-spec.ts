import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let devToken: string;
  let projectId: number;
  let ticketId: number;
  let adminId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.accessToken;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    adminId = me.body.id;

    const devUser = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'ticket_dev', email: 'ticket_dev@test.com', fullName: 'Dev', role: 'DEVELOPER', password: 'dev123' });

    const devLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'ticket_dev', password: 'dev123' });
    devToken = devLogin.body.accessToken;

    const proj = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ticket Test Project', description: 'e2e', ownerId: adminId });
    projectId = proj.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /tickets creates a ticket', async () => {
    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'First bug',
        status: 'TODO',
        priority: 'HIGH',
        type: 'BUG',
        projectId,
      })
      .expect(201);

    expect(res.body).toMatchObject({ id: expect.any(Number), title: 'First bug' });
    ticketId = res.body.id;
  });

  it('GET /tickets returns tickets for project', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t: any) => t.id === ticketId)).toBe(true);
  });

  it('GET /tickets/:id returns ticket', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.id).toBe(ticketId);
  });

  it('GET /tickets/:id returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .get('/tickets/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('PATCH /tickets/:id updates ticket (valid transition TODO -> IN_PROGRESS)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('PATCH /tickets/:id rejects invalid status transition', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' })
      .expect(400);
  });

  it('PATCH /tickets/:id rejects version conflict', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'conflict', version: 0 })
      .expect(409);
  });

  it('GET /tickets/export returns CSV', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/export?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('title');
  });

  it('POST /tickets/import imports tickets from CSV', async () => {
    const csv = 'title,description,status,priority,type,assigneeId\nImported Bug,from csv,TODO,LOW,BUG,\n';
    const res = await request(app.getHttpServer())
      .post(`/tickets/import?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csv), { filename: 'tickets.csv', contentType: 'text/csv' })
      .expect(201);
    expect(res.body.created).toBeGreaterThanOrEqual(1);
    expect(res.body.failed).toBe(0);
  });

  it('DELETE /tickets/:id soft-deletes ticket', async () => {
    await request(app.getHttpServer())
      .delete(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /tickets excludes soft-deleted ticket', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((t: any) => t.id === ticketId)).toBe(false);
  });

  it('GET /tickets/deleted returns deleted tickets (ADMIN)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/deleted?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((t: any) => t.id === ticketId)).toBe(true);
  });

  it('GET /tickets/deleted returns 403 for DEVELOPER', async () => {
    await request(app.getHttpServer())
      .get(`/tickets/deleted?projectId=${projectId}`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(403);
  });

  it('POST /tickets/:id/restore restores ticket (ADMIN)', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  it('GET /tickets includes restored ticket', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((t: any) => t.id === ticketId)).toBe(true);
  });

  it('POST /tickets/:id/restore returns 403 for DEVELOPER', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/restore`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(403);
  });

  it('POST /tickets returns 401 without token', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .send({ title: 'x', status: 'TODO', priority: 'LOW', type: 'BUG', projectId })
      .expect(401);
  });
});
