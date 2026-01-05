import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsEmail,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import type { ClientAddress } from '../client.entity';

export class UpdateClientDto {
  @ApiPropertyOptional({ description: 'Client name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Client email',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+27821234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Client address' })
  @IsOptional()
  @IsObject()
  address?: ClientAddress;

  @ApiPropertyOptional({
    description: 'External ID for sync from client registry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @ApiPropertyOptional({ description: 'VAT number', example: 'VAT123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vatNumber?: string;

  @ApiPropertyOptional({ description: 'Tax number', example: '9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxNumber?: string;

  @ApiPropertyOptional({
    description: 'Registration number',
    example: '2024/123456/07',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Notes about the client' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Whether the client is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
