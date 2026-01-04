import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowStateEntity } from './entities/workflow-state.entity';
import { WorkflowPersistenceService } from './services/workflow-persistence.service';
import { WorkflowExecutorService } from './services/workflow-executor.service';
import { InvoiceWorkflowService } from './services/invoice-workflow.service';
import { PaymentWorkflowService } from './services/payment-workflow.service';
import { BlnkModule } from '../blnk/blnk.module';
import { CreditNoteModule } from '../credit-note/credit-note.module';
import { InvoiceEntity } from '../invoice/invoice.entity';
import { PaymentEntity } from '../payment/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowStateEntity,
      InvoiceEntity,
      PaymentEntity,
    ]),
    BlnkModule,
    CreditNoteModule,
  ],
  providers: [
    WorkflowPersistenceService,
    WorkflowExecutorService,
    InvoiceWorkflowService,
    PaymentWorkflowService,
  ],
  exports: [
    WorkflowPersistenceService,
    WorkflowExecutorService,
    InvoiceWorkflowService,
    PaymentWorkflowService,
  ],
})
export class WorkflowModule {}
