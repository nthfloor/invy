import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({
    description: 'Issue date',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({
    description: 'Due date',
    example: '2024-02-14',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notes visible to client' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  terms?: string;
}

export class CancelInvoiceDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RecordPaymentDto {
  @ApiPropertyOptional({ description: 'Amount paid' })
  @IsOptional()
  amount?: number;
}
