import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { User } from './../src/entities/user.entity';
import { UserRole } from './../src/common/enums/user-role.enum';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let seededUserId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    // Seed test user directly (POST /users is JWT-protected)
    const userRepo = moduleFixture.get<any>(getRepositoryToken(User));
    await userRepo.delete({ username: 'authuser' });
    const passwordHash = await bcrypt.hash('password123', 10);
    const saved = await userRepo.save(
      userRepo.create({
        username: 'authuser',
        email: 'authuser@example.com',
        fullName: 'Auth User',
        role: UserRole.DEVELOPER,
        passwordHash,
      }),
    );
    seededUserId = saved.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login with missing body returns 400', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('POST /auth/login with valid credentials returns token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authuser', password: 'password123' })
      .expect(200);

    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
    accessToken = res.body.accessToken;
  });

  it('POST /auth/login with wrong password returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authuser', password: 'wrongpassword' })
      .expect(401);

    expect(res.body).toMatchObject({ statusCode: 401 });
  });

  it('GET /auth/me with valid token returns current user', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: seededUserId, username: 'authuser' });
  });

  it('GET /auth/me without token returns 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('POST /auth/logout invalidates token', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('GET /auth/me with blacklisted token returns 401', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
