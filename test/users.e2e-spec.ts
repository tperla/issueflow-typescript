import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { User } from './../src/entities/user.entity';
import { UserRole } from './../src/common/enums/user-role.enum';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdUserId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    // Seed admin directly to bootstrap a token (POST /users is also protected)
    const userRepo = moduleFixture.get<any>(getRepositoryToken(User));
    await userRepo.delete({ username: 'users_admin' });
    const passwordHash = await bcrypt.hash('admin123', 10);
    await userRepo.save(
      userRepo.create({
        username: 'users_admin',
        email: 'users_admin@test.com',
        fullName: 'Users Admin',
        role: UserRole.ADMIN,
        passwordHash,
      }),
    );

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'users_admin', password: 'admin123' });
    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users creates a user', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${authToken}`)
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
      .set('Authorization', `Bearer ${authToken}`)
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
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /users returns 401 without token', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('GET /users/:userId returns user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.id).toBe(createdUserId);
  });

  it('GET /users/:userId returns 404 for unknown id', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/999999')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: expect.any(String) });
  });

  it('POST /users/update/:userId updates user', async () => {
    const res = await request(app.getHttpServer())
      .post(`/users/update/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ fullName: 'Updated Name' })
      .expect(201);

    expect(res.body.fullName).toBe('Updated Name');
  });

  it('POST /users/update/:userId returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .post('/users/update/999999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ fullName: 'X' })
      .expect(404);
  });

  it('DELETE /users/:userId deletes user', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
  });

  it('DELETE /users/:userId returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .delete('/users/999999')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });
});
