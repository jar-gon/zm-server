import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Response } from './common/interceptors/response.interceptor';
import { HttpFilter } from './common/interceptors/filter.interceptor';
import { logger } from './common/middlewares/logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix(configService.get('API_PREFIX') as string);
  app.use(cookieParser());
  app.use(session(configService.get('session')));
  app.use(logger);
  app.useGlobalPipes(new ValidationPipe({ transform: true, stopAtFirstError: true }));
  app.useGlobalFilters(new HttpFilter());
  app.useGlobalInterceptors(new Response());

  // 接入swagger
  const swaggerConfig = new DocumentBuilder().setTitle(configService.get('swagger.title') as string).build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(configService.get('swagger.path') as string, app, document);

  await app.listen(configService.get('http.port', 3000));
}

void bootstrap();
