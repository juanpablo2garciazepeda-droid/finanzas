import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Meta } from '../metas/meta.entity';
import { Categoria } from '../categorias/categoria.entity';
import { TokenResetPassword } from '../auth/token-reset-password.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    UsersModule,
    AuditoriaModule,
    TypeOrmModule.forFeature([
      User,
      Transaccion,
      Deuda,
      Meta,
      Categoria,
      TokenResetPassword,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
