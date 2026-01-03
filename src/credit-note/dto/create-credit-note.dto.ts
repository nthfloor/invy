import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCreditNoteItemDto } from './create-credit-note-item.dto';

export class CreateCreditNoteDto {
  @ApiProperty({ description: 'Company ID' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ description: 'Invoice ID this credit note is against' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ description: 'Reason for issuing the credit note' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Issue date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Credit note line items',
    type: [CreateCreditNoteItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCreditNoteItemDto)
  items!: CreateCreditNoteItemDto[];
}
