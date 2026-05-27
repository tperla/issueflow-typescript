import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let createdUserId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users creates a user', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'e2euser',
        email: 'e2e@example.com',
        fullName: 'E2E User',
        role: 'DEVELOPER',
        password: 'secret123',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(Number),
      username: 'e2euser',
      email: 'e2e@example.com',
      role: 'DEVELOPER',
    });
    createdUserId = res.body.id;
  });

  it('POST /users returns 400 for invalid role', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'baduser',
        email: 'bad@example.com',
        fullName: 'Bad User',
        role: 'SUPERUSER',
        password: 'secret123',
      })
      .expect(400);

    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('GET /users returns array', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /users/:userId returns user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${createdUserId}`)
      .expect(200);

    expect(res.body.id).toBe(createdUserId);
  });

  it('GET /users/:userId returns 404 for unknown id', async () => {
    const res = await request(app.getHttpServer()).get('/users/999999').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: expect.any(String) });
  });

  it('POST /users/update/:userId updates user', async () => {
    const res = await request(app.getHttpServer())
      .post(`/users/update/${createdUserId}`)
      .send({ fullName: 'Updated Name' })
      .expect(201);

    expect(res.body.fullName).toBe('Updated Name');
  });

  it('POST /users/update/:userId returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .post('/users/update/999999')
      .send({ fullName: 'X' })
      .expect(404);
  });

  it('DELETE /users/:userId deletes user', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${createdUserId}`)
      .expect(200);
  });

  it('DELETE /users/:userId returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .delete('/users/999999')
      .expect(404);
  });
});
