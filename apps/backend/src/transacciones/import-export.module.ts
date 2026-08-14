import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportExportController } from './import-export.controller';
import { Categoria } from '../categorias/categoria.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Categoria, Transaccion]),
    UsersModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ImportExportController],
})
export class ImportExportModule {}
