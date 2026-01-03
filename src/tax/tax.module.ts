import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxEntity } from './tax.entity';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';
import { CompanyModule } from '../company/company.module';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaxEntity, ApiTokenEntity]),
    CompanyModule,
  ],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
