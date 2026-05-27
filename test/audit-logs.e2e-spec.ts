import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('AuditLogs (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let devToken: string;
  let adminId: number;
  let projectId: number;

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

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'auditlog_dev', email: 'auditlog_dev@test.com', fullName: 'Dev', role: 'DEVELOPER', password: 'dev123' });

    const devLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'auditlog_dev', password: 'dev123' });
    devToken = devLogin.body.accessToken;

    // Trigger a known audit log entry
    const proj = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Audit Test Project', description: 'e2e', ownerId: adminId });
    projectId = proj.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /audit-logs returns array (ADMIN)', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /audit-logs returns 403 for DEVELOPER', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(403);
  });

  it('GET /audit-logs returns 401 without token', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .expect(401);
  });

  it('GET /audit-logs includes log entry for the created project', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const match = res.body.find(
      (l: any) => l.entityType === 'PROJECT' && l.entityId === projectId && l.action === 'CREATE',
    );
    expect(match).toBeDefined();
  });

  it('GET /audit-logs?entityType=PROJECT filters by entityType', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entityType=PROJECT')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.every((l: any) => l.entityType === 'PROJECT')).toBe(true);
  });

  it('GET /audit-logs?action=CREATE filters by action', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?action=CREATE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.every((l: any) => l.action === 'CREATE')).toBe(true);
  });

  it('GET /audit-logs?actor=USER filters by actor', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?actor=USER')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.every((l: any) => l.actor === 'USER')).toBe(true);
  });

  it('GET /audit-logs?entityId=:id filters by entityId', async () => {
    const res = await request(app.getHttpServer())
      .get(`/audit-logs?entityId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.every((l: any) => l.entityId === projectId)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /audit-logs?entityType=PROJECT&action=CREATE combines filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entityType=PROJECT&action=CREATE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.every((l: any) => l.entityType === 'PROJECT' && l.action === 'CREATE')).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /audit-logs?entityType=INVALID returns 400', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs?entityType=INVALID')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
