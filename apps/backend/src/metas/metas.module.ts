import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meta } from './meta.entity';
import { AporteMeta } from './aporte-meta.entity';
import { MetasService } from './metas.service';
import { MetasController } from './metas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Meta, AporteMeta])],
  providers: [MetasService],
  controllers: [MetasController],
})
export class MetasModule {}
