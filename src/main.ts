import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3010;
  const nodeEnv = configService.get<string>('nodeEnv');

  // Security
  app.use(helmet());
  app.enableCors({
    origin: nodeEnv === 'development' ? '*' : [],
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

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Invy - Headless Invoicing Engine')
    .setDescription(
      'A standalone invoicing microservice providing CRUD operations for companies, clients, products, taxes, invoices, quotes, and estimates.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Health', 'Health check endpoints')
    .addTag('Companies', 'Company management')
    .addTag('Clients', 'Client management')
    .addTag('Taxes', 'Tax rate management')
    .addTag('Products', 'Product catalog')
    .addTag('Invoices', 'Invoice management with lifecycle')
    .addTag('Quotes', 'Quote management (fixed price)')
    .addTag('Estimates', 'Estimate management (variable price)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  logger.log(`Invy running on port ${port} in ${nodeEnv} mode`);
  logger.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

void bootstrap();
