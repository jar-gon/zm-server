import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { Response } from './../src/common/interceptors/response.interceptor';
import { HttpFilter } from './../src/common/interceptors/filter.interceptor';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: true,
      })
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true, stopAtFirstError: true }));
    app.useGlobalFilters(new HttpFilter());
    app.useGlobalInterceptors(new Response());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/common/captcha (GET)', () => {
    return request(app.getHttpServer()).get('/api/common/captcha').expect(200);
  });
});
