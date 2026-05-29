import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let devToken: string;
  let projectId: number;
  let ownerId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    // Login as seeded admin
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.accessToken;
    ownerId = adminLogin.body.id;

    // Get admin user id from /auth/me
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    ownerId = me.body.id;

    // Create a DEVELOPER user for role tests
    const devUser = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'proj_dev', email: 'proj_dev@test.com', fullName: 'Dev', role: 'DEVELOPER', password: 'dev123' });

    const devLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'proj_dev', password: 'dev123' });
    devToken = devLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /projects creates a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Project', description: 'A test', ownerId })
      .expect(200);

    expect(res.body).toMatchObject({ id: expect.any(Number), name: 'Test Project' });
    projectId = res.body.id;
  });

  it('GET /projects returns array excluding deleted', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('GET /projects/:id returns project', async () => {
    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.id).toBe(projectId);
  });

  it('GET /projects/:id returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .get('/projects/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('PATCH /projects/:id updates project', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Project' })
      .expect(200);
    expect(res.body.name).toBe('Updated Project');
  });

  it('GET /projects/:id/workload returns array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}/workload`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /projects/:id soft-deletes project', async () => {
    await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /projects excludes soft-deleted project', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(false);
  });

  it('GET /projects/deleted returns deleted projects (ADMIN)', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects/deleted')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('GET /projects/deleted returns 403 for DEVELOPER', async () => {
    await request(app.getHttpServer())
      .get('/projects/deleted')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(403);
  });

  it('POST /projects/:id/restore restores project (ADMIN)', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /projects includes restored project', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('POST /projects/:id/restore returns 403 for DEVELOPER', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/restore`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(403);
  });
});
