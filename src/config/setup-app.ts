import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import MongoStore from 'connect-mongo';
import type { CookieOptions, Express } from 'express';
import session, { SessionOptions } from 'express-session';
import cookieParser from 'cookie-parser';
import { Response } from 'src/common/interceptors/response.interceptor';
import { HttpFilter } from 'src/common/interceptors/filter.interceptor';

export function getCookieOptions(configService: ConfigService): CookieOptions {
  const cookie = { ...configService.get<CookieOptions>('cookie') };
  if (!cookie.domain) {
    delete cookie.domain;
  }
  return cookie;
}

export function setupApp(app: INestApplication) {
  const configService = app.get(ConfigService);
  app.setGlobalPrefix(configService.getOrThrow<string>('API_PREFIX'));
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', configService.get<boolean | string | string[] | number>('http.trustProxy', false));
  app.use(cookieParser());
  const sessionOptions: SessionOptions = {
    ...configService.getOrThrow<SessionOptions>('session'),
    cookie: getCookieOptions(configService),
  };
  if (configService.get<string>('sessionStore') === 'mongo') {
    const connection = app.get<Connection>(getConnectionToken());
    sessionOptions.store = MongoStore.create({ client: connection.getClient(), dbName: connection.name });
  }
  app.use(session(sessionOptions));
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: true })
  );
  app.useGlobalFilters(new HttpFilter());
  app.useGlobalInterceptors(new Response());
}
