import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GastoRecurrente } from './gasto-recurrente.entity';
import { Categoria } from '../categorias/categoria.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { RecurrentesService } from './recurrentes.service';
import { RecurrentesController } from './recurrentes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GastoRecurrente, Categoria, Transaccion])],
  providers: [RecurrentesService],
  controllers: [RecurrentesController],
  exports: [RecurrentesService],
})
export class RecurrentesModule {}
