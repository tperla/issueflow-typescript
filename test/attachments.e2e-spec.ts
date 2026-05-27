import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Attachments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let projectId: number;
  let ticketId: number;
  let attachmentId: number;

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
      .send({ name: 'Attachment Test Project', description: 'e2e', ownerId: adminId });
    projectId = proj.body.id;

    const ticket = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Attach Ticket', status: 'TODO', priority: 'LOW', type: 'BUG', projectId });
    ticketId = ticket.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /tickets/:id/attachments uploads a valid file', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('fake image data'), { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(Number),
      ticketId,
      filename: 'photo.png',
      contentType: 'image/png',
    });
    expect(res.body).not.toHaveProperty('data');
    attachmentId = res.body.id;
  });

  it('POST /tickets/:id/attachments accepts PDF', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'doc.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(res.body.contentType).toBe('application/pdf');
  });

  it('POST /tickets/:id/attachments returns 415 for disallowed MIME type', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('#!/bin/sh'), { filename: 'script.sh', contentType: 'application/x-sh' })
      .expect(415);

    expect(res.body.statusCode).toBe(415);
  });

  it('POST /tickets/:id/attachments returns 413 for oversized file', async () => {
    const oversized = Buffer.alloc(11 * 1024 * 1024, 'x');
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' })
      .expect(413);
  });

  it('POST /tickets/:id/attachments returns 400 when no file provided', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('DELETE /tickets/:id/attachments/:attachmentId deletes attachment', async () => {
    await request(app.getHttpServer())
      .delete(`/tickets/${ticketId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('DELETE /tickets/:id/attachments/:attachmentId returns 404 when not found', async () => {
    await request(app.getHttpServer())
      .delete(`/tickets/${ticketId}/attachments/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('POST /tickets/:id/attachments returns 401 without token', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .attach('file', Buffer.from('data'), { filename: 'f.png', contentType: 'image/png' })
      .expect(401);
  });
});
