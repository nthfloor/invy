import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import type { Context, APIGatewayProxyEvent } from 'aws-lambda';
import express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/http-exception.filter';

// Cache the server instance for warm starts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedServer: any;

async function bootstrap() {
  if (cachedServer) {
    return cachedServer;
  }

  const logger = new Logger('Lambda');
  logger.log('Cold start - initializing NestJS application');

  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter, {
    logger: ['error', 'warn', 'log'],
  });

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // API prefix
  app.setGlobalPrefix('api/v1');

  await app.init();

  cachedServer = serverlessExpress({ app: expressApp });
  logger.log('NestJS application initialized successfully');

  return cachedServer;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
) => {
  const server = await bootstrap();
  return server(event, context, () => {});
};
