import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Ajuste } from '../ajustes/ajuste.entity';
import { EmailModule } from '../auth/email.module';
import { RecordatoriosService } from './recordatorios.service';

/**
 * Cron diario que avisa por correo de los pagos que vencen. No expone
 * endpoints: su única entrada es el reloj.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Deuda, Ajuste]), EmailModule],
  providers: [RecordatoriosService],
  exports: [RecordatoriosService],
})
export class RecordatoriosModule {}
