import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AjustesModule } from '../ajustes/ajustes.module';
import { AporteMeta } from '../metas/aporte-meta.entity';
import { Categoria } from '../categorias/categoria.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Meta } from '../metas/meta.entity';
import { PagoDeuda } from '../deudas/pago-deuda.entity';
import { Presupuesto } from '../presupuestos/presupuesto.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { GastoRecurrente } from '../recurrentes/gasto-recurrente.entity';
import { InicioController } from './inicio.controller';

/**
 * `GET /inicio` devuelve en una sola request todo lo que el Tablero necesita
 * para pintarse. Antes el cliente pedía 6 endpoints en paralelo y luego
 * un GET por cada deuda y por cada meta (≈11 requests con un par de metas
 * y deudas); el cuello era la latencia, no el ancho de banda.
 *
 * Aquí se ejecutan en paralelo dentro del proceso, así que el navegador
 * paga un solo round-trip y el backend paga una sola andanada de queries.
 */
@Module({
  imports: [
    AjustesModule,
    TypeOrmModule.forFeature([
      Categoria,
      Transaccion,
      Presupuesto,
      Deuda,
      PagoDeuda,
      Meta,
      AporteMeta,
      GastoRecurrente,
    ]),
  ],
  controllers: [InicioController],
})
export class InicioModule {}
