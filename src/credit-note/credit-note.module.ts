import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditNoteEntity, CreditNoteItemEntity } from './credit-note.entity';
import { CreditNoteService } from './credit-note.service';
import { CreditNoteController } from './credit-note.controller';
import { CompanyModule } from '../company/company.module';
import { ClientModule } from '../client/client.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { NumberSequenceEntity } from '../shared/entities/number-sequence.entity';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';
import { PdfModule } from '../shared/pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditNoteEntity,
      CreditNoteItemEntity,
      NumberSequenceEntity,
      ApiTokenEntity,
    ]),
    CompanyModule,
    ClientModule,
    InvoiceModule,
    PdfModule,
  ],
  controllers: [CreditNoteController],
  providers: [CreditNoteService, NumberSequenceService],
  exports: [CreditNoteService],
})
export class CreditNoteModule {}
