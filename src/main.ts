import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setupApp } from './config/setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  setupApp(app);
  app.enableShutdownHooks();

  // 接入swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.getOrThrow<string>('swagger.title'))
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(configService.get('swagger.path') as string, app, document);

  await app.listen(configService.get('http.port', 3000));
}

void bootstrap();
