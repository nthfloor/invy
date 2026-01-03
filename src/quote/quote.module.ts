import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteEntity, QuoteItemEntity } from './quote.entity';
import { InvoiceEntity, InvoiceItemEntity } from '../invoice/invoice.entity';
import { QuoteService } from './quote.service';
import { QuoteController, EstimateController } from './quote.controller';
import { CompanyModule } from '../company/company.module';
import { ClientModule } from '../client/client.module';
import { NumberSequenceEntity } from '../shared/entities/number-sequence.entity';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuoteEntity,
      QuoteItemEntity,
      InvoiceEntity,
      InvoiceItemEntity,
      NumberSequenceEntity,
      ApiTokenEntity,
    ]),
    CompanyModule,
    ClientModule,
  ],
  controllers: [QuoteController, EstimateController],
  providers: [QuoteService, NumberSequenceService],
  exports: [QuoteService],
})
export class QuoteModule {}
