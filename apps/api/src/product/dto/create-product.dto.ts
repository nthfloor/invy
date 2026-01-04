import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Company ID this product belongs to' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'Product name', example: 'Consultation Service' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Unit price', example: 500.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Default tax ID for this product' })
  @IsOptional()
  @IsUUID()
  taxId?: string;

  @ApiPropertyOptional({ description: 'SKU code', example: 'CONSULT-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;
}
