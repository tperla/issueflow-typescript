import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Comments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let devToken: string;
  let adminId: number;
  let devId: number;
  let projectId: number;
  let ticketId: number;
  let commentId: number;

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

    // Create dev user for mention tests
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'comment_dev', email: 'comment_dev@test.com', fullName: 'Dev User', role: 'DEVELOPER', password: 'dev123' });

    const devLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'comment_dev', password: 'dev123' });
    devToken = devLogin.body.accessToken;

    const devMe = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${devToken}`);
    devId = devMe.body.id;

    // Create project and ticket
    const proj = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Comment Test Project', description: 'e2e', ownerId: adminId });
    projectId = proj.body.id;

    const ticket = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test Ticket', status: 'TODO', priority: 'MEDIUM', type: 'BUG', projectId });
    ticketId = ticket.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /tickets/:id/comments creates a comment', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'First comment' })
      .expect(200);

    expect(res.body).toMatchObject({ id: expect.any(Number), content: 'First comment' });
    commentId = res.body.id;
  });

  it('POST /tickets/:id/comments creates comment with @mention', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: `Hey @comment_dev please review` })
      .expect(200);

    expect(res.body.mentionedUsers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: devId })])
    );
  });

  it('POST /tickets/:id/comments handles case-insensitive @mention', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: `cc @COMMENT_DEV` })
      .expect(200);

    expect(res.body.mentionedUsers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: devId })])
    );
  });

  it('POST /tickets/:id/comments silently ignores unknown @mention', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Hey @nonexistentuser123' })
      .expect(200);

    expect(res.body.mentionedUsers).toEqual([]);
  });

  it('GET /tickets/:id/comments returns array of comments', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: any) => c.id === commentId)).toBe(true);
  });

  it('PATCH /tickets/:id/comments/:commentId updates content', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Updated comment', version: 1 })
      .expect(200);

    expect(res.body.content).toBe('Updated comment');
  });

  it('PATCH /tickets/:id/comments/:commentId updates and removes mention', async () => {
    // Create comment with mention
    const created = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: `Hello @comment_dev` })
      .expect(200);

    const id = created.body.id;
    expect(created.body.mentionedUsers.length).toBeGreaterThan(0);

    // Update without mention
    const updated = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/comments/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'No more mentions' })
      .expect(200);

    expect(updated.body.mentionedUsers).toEqual([]);
  });

  it('PATCH /tickets/:id/comments/:commentId returns 409 on version conflict', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'conflict', version: 0 })
      .expect(409);
  });

  it('PATCH /tickets/:id/comments/:commentId returns 404 for unknown comment', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/comments/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'x' })
      .expect(404);
  });

  it('GET /users/:userId/mentions returns comments mentioning the user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${devId}/mentions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
    res.body.data.forEach((c: any) => {
      expect(c.mentionedUsers.some((u: any) => u.id === devId)).toBe(true);
    });
  });

  it('DELETE /tickets/:id/comments/:commentId deletes comment', async () => {
    await request(app.getHttpServer())
      .delete(`/tickets/${ticketId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /tickets/:id/comments excludes deleted comment', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.some((c: any) => c.id === commentId)).toBe(false);
  });

  it('POST /tickets/:id/comments returns 401 without token', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .send({ content: 'no auth' })
      .expect(401);
  });

  it('POST /tickets/:id/comments returns 400 for empty content', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '' })
      .expect(400);
  });
});
