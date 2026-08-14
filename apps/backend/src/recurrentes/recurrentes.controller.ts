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
import { RecurrentesService } from './recurrentes.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import {
  ActualizarRecurrenteDto,
  CrearRecurrenteDto,
} from './recurrentes.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('recurrentes')
export class RecurrentesController {
  constructor(private readonly recurrentes: RecurrentesService) {}

  @Get()
  listar(@CurrentUser() user: JwtPayload) {
    return this.recurrentes.listar(user.sub);
  }

  @Post()
  crear(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CrearRecurrenteDto,
  ) {
    return this.recurrentes.crear(user.sub, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarRecurrenteDto,
  ) {
    return this.recurrentes.actualizar(user.sub, id, dto);
  }

  @Delete(':id')
  eliminar(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.recurrentes.eliminar(user.sub, id);
  }
}
