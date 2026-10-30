import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { appConfig } from './config/env';
import { HttpExceptionFilter } from './common/http-exception.filter';

export const createApp = async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: appConfig.MAX_BODY_SIZE,
      logger: appConfig.NODE_ENV !== 'production',
      ignoreTrailingSlash: true,
    }),
  );

  app.enableCors({
    origin: appConfig.CORS_ORIGIN === '*' ? true : appConfig.CORS_ORIGIN,
    credentials: true,
  });

  const fastifyInstance = app.getHttpAdapter().getInstance() as { trustProxy?: boolean };

  if (appConfig.TRUST_PROXY) fastifyInstance.trustProxy = true;

  app.useGlobalFilters(new HttpExceptionFilter());

  if (appConfig.SWAGGER_ENABLED) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ShortLink API')
        .setDescription('Short URL API for the MVP')
        .setVersion('1.0')
        .addServer(appConfig.PUBLIC_BASE_URL)
        .build(),
    );

    SwaggerModule.setup('api/docs', app, document);
  }

  return app;
};
