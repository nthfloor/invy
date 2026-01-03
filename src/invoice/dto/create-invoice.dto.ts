import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class CreateInvoiceItemDto {
  @ApiPropertyOptional({ description: 'Product ID (optional)' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ description: 'Line item description' })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ description: 'Unit price', example: 100.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Tax rate percentage', example: 15.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Company ID' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({
    description: 'Issue date (defaults to today)',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({
    description: 'Due date (defaults to issueDate + paymentTermsDays)',
    example: '2024-02-14',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({
    description: 'Invoice line items',
    type: [CreateInvoiceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  @ArrayMinSize(1)
  items!: CreateInvoiceItemDto[];

  @ApiPropertyOptional({ description: 'Notes visible to client' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  terms?: string;
}
