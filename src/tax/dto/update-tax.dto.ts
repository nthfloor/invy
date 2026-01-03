import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UpdateTaxDto {
  @ApiPropertyOptional({ description: 'Tax name', example: 'VAT 15%' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Tax rate percentage', example: 15.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate?: number;

  @ApiPropertyOptional({ description: 'Whether the tax is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
