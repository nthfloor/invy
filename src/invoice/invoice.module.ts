import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceEntity, InvoiceItemEntity } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { CompanyModule } from '../company/company.module';
import { ClientModule } from '../client/client.module';
import { NumberSequenceEntity } from '../shared/entities/number-sequence.entity';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceEntity,
      InvoiceItemEntity,
      NumberSequenceEntity,
      ApiTokenEntity,
    ]),
    CompanyModule,
    ClientModule,
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, NumberSequenceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
