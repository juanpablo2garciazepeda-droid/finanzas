import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriasModule } from './categorias/categorias.module';
import { TransaccionesModule } from './transacciones/transacciones.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { DeudasModule } from './deudas/deudas.module';
import { MetasModule } from './metas/metas.module';
import { AjustesModule } from './ajustes/ajustes.module';
import { HealthModule } from './health/health.module';
import { dataSourceOptions } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    UsersModule,
    CategoriasModule,
    TransaccionesModule,
    PresupuestosModule,
    DeudasModule,
    MetasModule,
    AjustesModule,
    HealthModule,
  ],
})
export class AppModule {}
