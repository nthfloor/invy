import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';

import configuration, { configValidationSchema } from './config/configuration';

// Middleware
import { CorrelationIdMiddleware } from './shared/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './shared/middleware/request-logger.middleware';

// Feature Modules
import { HealthModule } from './health/health.module';
import { CompanyModule } from './company/company.module';
import { ClientModule } from './client/client.module';
import { TaxModule } from './tax/tax.module';
import { ProductModule } from './product/product.module';
import { InvoiceModule } from './invoice/invoice.module';
import { QuoteModule } from './quote/quote.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: configValidationSchema,
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('nodeEnv') === 'development',
        logging: configService.get<string>('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Health checks
    TerminusModule,
    HealthModule,

    // Feature modules
    CompanyModule,
    ClientModule,
    TaxModule,
    ProductModule,
    InvoiceModule,
    QuoteModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
