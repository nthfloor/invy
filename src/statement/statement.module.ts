import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatementService } from './statement.service';
import { StatementController } from './statement.controller';
import { InvoiceEntity } from '../invoice/invoice.entity';
import {
  PaymentEntity,
  PaymentAllocationEntity,
} from '../payment/payment.entity';
import { CreditNoteEntity } from '../credit-note/credit-note.entity';
import { ClientEntity } from '../client/client.entity';
import { CompanyEntity } from '../company/company.entity';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';
import { PdfModule } from '../shared/pdf/pdf.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceEntity,
      PaymentEntity,
      PaymentAllocationEntity,
      CreditNoteEntity,
      ClientEntity,
      CompanyEntity,
      ApiTokenEntity,
    ]),
    PdfModule,
    CompanyModule,
  ],
  controllers: [StatementController],
  providers: [StatementService],
  exports: [StatementService],
})
export class StatementModule {}
