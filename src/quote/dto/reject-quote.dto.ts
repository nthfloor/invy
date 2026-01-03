import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class RejectQuoteDto {
  @ApiPropertyOptional({
    description: 'Reason for rejection',
    example: 'Budget constraints',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
