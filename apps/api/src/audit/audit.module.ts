import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventEntity } from './audit.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Global() // Make AuditService available globally for easy integration
@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity, ApiTokenEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
