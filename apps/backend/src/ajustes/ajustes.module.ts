import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ajuste } from './ajuste.entity';
import { AjustesService } from './ajustes.service';
import { AjustesController } from './ajustes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ajuste])],
  providers: [AjustesService],
  controllers: [AjustesController],
})
export class AjustesModule {}
