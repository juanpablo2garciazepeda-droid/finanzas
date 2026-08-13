import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeudasService } from './deudas.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { Deuda } from './deuda.entity';
import { PagoDeuda } from './pago-deuda.entity';
import { DeepPartial } from 'typeorm';

@Controller('deudas')
@UseGuards(AuthGuard('jwt'))
export class DeudasController {
  constructor(private readonly service: DeudasService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.service.list(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findOne(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() input: DeepPartial<Deuda>) {
    return this.service.create(user.sub, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DeepPartial<Deuda>,
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

  @Get(':id/pagos')
  listPagos(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.listPagos(user.sub, id);
  }

  @Post(':id/pagos')
  addPago(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: Partial<PagoDeuda>,
  ) {
    return this.service.addPago(user.sub, id, input);
  }
}
