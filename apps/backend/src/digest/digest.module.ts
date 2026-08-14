import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DigestService } from './digest.service';
import { User } from '../users/user.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Ajuste } from '../ajustes/ajuste.entity';
import { EmailModule } from '../auth/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Transaccion, Deuda, Ajuste]),
    EmailModule,
  ],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
