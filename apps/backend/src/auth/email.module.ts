import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * EmailService como módulo global: AuthService y DigestService lo
 * necesitan, y meterlo en cada uno genera dependencia circular.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
