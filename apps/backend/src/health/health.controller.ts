import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle({ default: true, auth: true })
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
