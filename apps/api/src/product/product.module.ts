import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './product.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { CompanyModule } from '../company/company.module';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, ApiTokenEntity]),
    CompanyModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
