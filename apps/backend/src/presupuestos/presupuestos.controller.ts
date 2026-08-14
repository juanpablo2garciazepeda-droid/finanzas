import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PresupuestosService } from './presupuestos.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { Presupuesto } from './presupuesto.entity';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { CrearPresupuestoDto, ActualizarPresupuestoDto } from '../common/dominio.dto';

@Controller('presupuestos')
@UseGuards(AuthGuard('jwt'))
export class PresupuestosController {
  constructor(private readonly service: PresupuestosService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('periodo') periodo?: string,
  ) {
    const where: FindOptionsWhere<Presupuesto> = {};
    if (periodo) where.periodo = periodo;
    return this.service.list(user.sub, where);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findOne(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() input: CrearPresupuestoDto) {
    return this.service.create(user.sub, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ActualizarPresupuestoDto,
  ) {
    return this.service.update(user.sub, id, input);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(user.sub, id);
  }
}
