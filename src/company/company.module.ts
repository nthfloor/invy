import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from './company.entity';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity, ApiTokenEntity])],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
