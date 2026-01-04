import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteEntity, QuoteItemEntity } from './quote.entity';
import { InvoiceEntity, InvoiceItemEntity } from '../invoice/invoice.entity';
import { QuoteService } from './quote.service';
import { QuoteController, EstimateController } from './quote.controller';
import { CompanyModule } from '../company/company.module';
import { ClientModule } from '../client/client.module';
import { CreditNoteModule } from '../credit-note/credit-note.module';
import { NumberSequenceEntity } from '../shared/entities/number-sequence.entity';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';
import { PdfModule } from '../shared/pdf/pdf.module';

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
    forwardRef(() => CreditNoteModule), // forwardRef to avoid circular dependency
    PdfModule,
  ],
  controllers: [QuoteController, EstimateController],
  providers: [QuoteService, NumberSequenceService],
  exports: [QuoteService],
})
export class QuoteModule {}
