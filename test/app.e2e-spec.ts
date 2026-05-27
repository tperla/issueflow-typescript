import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('App (e2e)', () => {
  let app: INestApplication;

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

  it('GET / returns health check', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('IssueFlow is running!');
  });

  it('error response shape is { statusCode, message, error }', async () => {
    const res = await request(app.getHttpServer()).get('/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: expect.any(String),
      error: expect.any(String),
    });
  });
});
