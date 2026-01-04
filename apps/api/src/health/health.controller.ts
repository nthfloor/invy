import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @HealthCheck()
  check() {
    return this.health.check([]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (includes database)' })
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
