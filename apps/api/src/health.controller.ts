import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

import type { HealthResponse } from '@shortlink/contracts';

@ApiTags('health')
@Controller('api/v1')
export class HealthController {
  @Get('health')
  @ApiResponse({
    status: 200,
    description: 'Application health status.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['status', 'timestamp'],
    },
  })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
