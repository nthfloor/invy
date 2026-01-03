import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  MaxLength,
  IsBoolean,
  Length,
} from 'class-validator';
import {
  CompanyAddress,
  CompanySettings,
  CompanyBranding,
} from '../company.entity';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name', example: 'Acme Corp' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    description: 'Tax ID (VAT/GST number)',
    example: 'VAT123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    example: 'ZAR',
    default: 'ZAR',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Company address' })
  @IsOptional()
  @IsObject()
  address?: CompanyAddress;

  @ApiPropertyOptional({ description: 'Company settings' })
  @IsOptional()
  @IsObject()
  settings?: CompanySettings;

  @ApiPropertyOptional({ description: 'Company branding' })
  @IsOptional()
  @IsObject()
  branding?: CompanyBranding;
}
