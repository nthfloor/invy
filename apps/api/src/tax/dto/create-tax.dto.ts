import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateTaxDto {
  @ApiProperty({ description: 'Company ID this tax belongs to' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'Tax name', example: 'VAT 15%' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Tax rate percentage', example: 15.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate!: number;

  @ApiPropertyOptional({
    description: 'Set as default tax for this company',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
