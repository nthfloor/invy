import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  IsOptional,
  IsUUID,
  IsNumber,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustedItemDto {
  @ApiPropertyOptional({
    description: 'Quote item ID to adjust',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  quoteItemId!: string;

  @ApiPropertyOptional({ description: 'Adjusted quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Adjusted unit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Adjusted description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class AdditionalItemDto {
  @ApiPropertyOptional({
    description: 'Product ID (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Item description',
    example: 'Additional work performed',
  })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ description: 'Quantity', example: 5 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Unit price', example: 100.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({
    description: 'Tax rate as percentage',
    example: 15,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class ConvertToInvoiceDto {
  @ApiPropertyOptional({
    description: 'Adjusted items (only for estimates where isFixedPrice=false)',
    type: [AdjustedItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjustedItemDto)
  adjustedItems?: AdjustedItemDto[];

  @ApiPropertyOptional({
    description: 'Additional items not in original quote/estimate',
    type: [AdditionalItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalItemDto)
  additionalItems?: AdditionalItemDto[];
}
