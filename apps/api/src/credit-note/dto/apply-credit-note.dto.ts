import { IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCreditNoteDto {
  @ApiProperty({ description: 'Invoice ID to apply credit to' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ description: 'Amount to apply from credit note' })
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
