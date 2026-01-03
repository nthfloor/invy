import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PaymentMethod } from '../payment.entity';

export class PaymentAllocationDto {
  @ApiProperty({ description: 'Invoice item ID to allocate payment to' })
  @IsUUID()
  invoiceItemId!: string;

  @ApiProperty({ description: 'Amount to allocate to this line item' })
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class CreatePaymentDto {
  @ApiProperty({ description: 'Company ID' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'Invoice ID this payment is for' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    description: 'Payment method',
    enum: [
      'cash',
      'bank_transfer',
      'credit_card',
      'debit_card',
      'cheque',
      'credit_note',
      'other',
    ],
  })
  @IsEnum([
    'cash',
    'bank_transfer',
    'credit_card',
    'debit_card',
    'cheque',
    'credit_note',
    'other',
  ])
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Payment date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({
    description: 'External reference (bank ref, transaction ID)',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Credit note ID if payment is from a credit note',
  })
  @IsOptional()
  @IsUUID()
  creditNoteId?: string;

  @ApiPropertyOptional({
    description: 'Optional line item allocations for detailed tracking',
    type: [PaymentAllocationDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations?: PaymentAllocationDto[];
}
