import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCreditNoteItemDto {
  @ApiPropertyOptional({ description: 'Original invoice item ID (optional)' })
  @IsOptional()
  @IsUUID()
  invoiceItemId?: string;

  @ApiPropertyOptional({ description: 'Product ID (optional)' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ description: 'Item description' })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Tax rate percentage (default 0)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}
