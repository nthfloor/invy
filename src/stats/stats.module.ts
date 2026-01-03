import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { InvoiceEntity } from '../invoice/invoice.entity';
import { QuoteEntity } from '../quote/quote.entity';
import { ClientEntity } from '../client/client.entity';
import { ProductEntity } from '../product/product.entity';
import { CreditNoteEntity } from '../credit-note/credit-note.entity';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceEntity,
      QuoteEntity,
      ClientEntity,
      ProductEntity,
      CreditNoteEntity,
      ApiTokenEntity,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
