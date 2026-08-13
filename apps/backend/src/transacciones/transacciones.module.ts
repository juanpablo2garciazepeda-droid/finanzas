import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaccion } from './transaccion.entity';
import { TransaccionesService } from './transacciones.service';
import { TransaccionesController } from './transacciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Transaccion])],
  providers: [TransaccionesService],
  controllers: [TransaccionesController],
})
export class TransaccionesModule {}
