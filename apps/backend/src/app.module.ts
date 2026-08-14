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
 *   · default 100 req / 60s por IP — la app normal.
 *   · auth 10/60s — login/register/olvide (los @Throttle en controllers
 *     sobreescriben estos valores en cada ruta).
 *
 * `default` aplica a todas las rutas; las sensibles se saltan el rate
 * limit con @SkipThrottle (ej. /health).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 10 },
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
