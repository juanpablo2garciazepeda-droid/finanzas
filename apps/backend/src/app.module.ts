import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriasModule } from './categorias/categorias.module';
import { TransaccionesModule } from './transacciones/transacciones.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { DeudasModule } from './deudas/deudas.module';
import { MetasModule } from './metas/metas.module';
import { AjustesModule } from './ajustes/ajustes.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { HealthModule } from './health/health.module';
import { AuditoriaController } from './auditoria/auditoria.controller';
import { ThrottlerBackendGuard } from './common/throttler-bypass.guard';
import { dataSourceOptions } from './database/data-source';

/**
 * Throttler: limites por defecto y específicos para auth.
 *   · default 100 req / 60s por IP — suficiente para la app normal.
 *   · auth  lo ajustan los @Throttle() en los controllers.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 10 },
      { name: 'auth-estricto', ttl: 3_600_000, limit: 5 },
    ]),
    AuthModule,
    UsersModule,
    AuditoriaModule,
    CategoriasModule,
    TransaccionesModule,
    PresupuestosModule,
    DeudasModule,
    MetasModule,
    AjustesModule,
    HealthModule,
  ],
  controllers: [AuditoriaController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerBackendGuard },
  ],
})
export class AppModule {}
