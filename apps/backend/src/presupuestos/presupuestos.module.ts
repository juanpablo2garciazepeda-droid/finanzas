import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Presupuesto } from './presupuesto.entity';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestosController } from './presupuestos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Presupuesto])],
  providers: [PresupuestosService],
  controllers: [PresupuestosController],
})
export class PresupuestosModule {}
