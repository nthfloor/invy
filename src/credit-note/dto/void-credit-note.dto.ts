import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidCreditNoteDto {
  @ApiProperty({ description: 'Reason for voiding the credit note' })
  @IsString()
  reason!: string;
}
