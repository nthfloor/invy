import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity, PaymentAllocationEntity } from './payment.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { InvoiceModule } from '../invoice/invoice.module';
import { CompanyModule } from '../company/company.module';
import { NumberSequenceEntity } from '../shared/entities/number-sequence.entity';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentAllocationEntity,
      NumberSequenceEntity,
      ApiTokenEntity,
    ]),
    InvoiceModule,
    CompanyModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, NumberSequenceService],
  exports: [PaymentService],
})
export class PaymentModule {}
