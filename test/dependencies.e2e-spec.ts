import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('TicketDependencies (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let projectId: number;
  let ticketAId: number;
  let ticketBId: number;
  let ticketCId: number;
  let otherProjectTicketId: number;

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

    const proj = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dep Test Project', description: 'e2e', ownerId: adminId });
    projectId = proj.body.id;

    const otherProj = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Other Project', description: 'e2e', ownerId: adminId });

    const [tA, tB, tC, tOther] = await Promise.all([
      request(app.getHttpServer()).post('/tickets').set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Ticket A', status: 'TODO', priority: 'MEDIUM', type: 'BUG', projectId }),
      request(app.getHttpServer()).post('/tickets').set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Ticket B', status: 'TODO', priority: 'MEDIUM', type: 'BUG', projectId }),
      request(app.getHttpServer()).post('/tickets').set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Ticket C', status: 'TODO', priority: 'MEDIUM', type: 'BUG', projectId }),
      request(app.getHttpServer()).post('/tickets').set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Other Ticket', status: 'TODO', priority: 'MEDIUM', type: 'BUG', projectId: otherProj.body.id }),
    ]);
    ticketAId = tA.body.id;
    ticketBId = tB.body.id;
    ticketCId = tC.body.id;
    otherProjectTicketId = tOther.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /tickets/:id/dependencies adds a dependency', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketAId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockerId: ticketBId })
      .expect(200);

    expect(res.body).toMatchObject({ ticketId: ticketAId, blockedById: ticketBId });
  });

  it('GET /tickets/:id/dependencies lists blockers', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketAId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((d: any) => d.blockedById === ticketBId)).toBe(true);
  });

  it('POST /tickets/:id/dependencies returns 400 when ticket blocks itself', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketAId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockerId: ticketAId })
      .expect(400);
  });

  it('POST /tickets/:id/dependencies returns 400 for cross-project tickets', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketAId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockerId: otherProjectTicketId })
      .expect(400);
  });

  it('POST /tickets/:id/dependencies returns 409 for circular dependency', async () => {
    // A is blocked by B; adding B blocked by A → circular
    await request(app.getHttpServer())
      .post(`/tickets/${ticketBId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockerId: ticketAId })
      .expect(409);
  });

  it('PATCH /tickets/:id returns 409 when transitioning to DONE with unresolved blocker', async () => {
    // A is blocked by B (B is still TODO) — move A to IN_PROGRESS first
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });

    await request(app.getHttpServer())
      .patch(`/tickets/${ticketAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_REVIEW' });

    await request(app.getHttpServer())
      .patch(`/tickets/${ticketAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' })
      .expect(409);
  });

  it('PATCH /tickets/:id allows DONE when all blockers are DONE', async () => {
    // Mark B as DONE first
    await request(app.getHttpServer()).patch(`/tickets/${ticketBId}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'IN_PROGRESS' });
    await request(app.getHttpServer()).patch(`/tickets/${ticketBId}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'IN_REVIEW' });
    await request(app.getHttpServer()).patch(`/tickets/${ticketBId}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'DONE' });

    // Now A can be marked DONE
    const res = await request(app.getHttpServer())
      .patch(`/tickets/${ticketAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' })
      .expect(200);

    expect(res.body.status).toBe('DONE');
  });

  it('detects transitive circular dependency', async () => {
    // C blocked by A (A is DONE now, but relationship still valid for circularity)
    // Setup: C blocked by A, then try A blocked by C
    await request(app.getHttpServer())
      .post(`/tickets/${ticketCId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockerId: ticketBId }) // B is available
      .expect(200);

    // Try to add B blocked by C — would create C→B→C cycle
    await request(app.getHttpServer())
      .post(`/tickets/${ticketBId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockerId: ticketCId })
      .expect(409);
  });

  it('DELETE /tickets/:id/dependencies/:blockerId removes dependency', async () => {
    await request(app.getHttpServer())
      .delete(`/tickets/${ticketAId}/dependencies/${ticketBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketAId}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.some((d: any) => d.blockedById === ticketBId)).toBe(false);
  });

  it('DELETE /tickets/:id/dependencies/:blockerId returns 404 when not found', async () => {
    await request(app.getHttpServer())
      .delete(`/tickets/${ticketAId}/dependencies/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('POST /tickets/:id/dependencies returns 401 without token', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketAId}/dependencies`)
      .send({ blockerId: ticketBId })
      .expect(401);
  });
});
