import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deuda } from './deuda.entity';
import { PagoDeuda } from './pago-deuda.entity';
import { DeudasService } from './deudas.service';
import { DeudasController } from './deudas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Deuda, PagoDeuda])],
  providers: [DeudasService],
  controllers: [DeudasController],
})
export class DeudasModule {}
