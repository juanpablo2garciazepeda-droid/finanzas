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
import { MetasService } from './metas.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { Meta } from './meta.entity';
import { AporteMeta } from './aporte-meta.entity';
import { DeepPartial } from 'typeorm';

@Controller('metas')
@UseGuards(AuthGuard('jwt'))
export class MetasController {
  constructor(private readonly service: MetasService) {}

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
  create(@CurrentUser() user: JwtPayload, @Body() input: DeepPartial<Meta>) {
    return this.service.create(user.sub, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DeepPartial<Meta>,
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

  @Get(':id/aportes')
  listAportes(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.listAportes(user.sub, id);
  }

  @Post(':id/aportes')
  addAporte(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: Partial<AporteMeta>,
  ) {
    return this.service.addAporte(user.sub, id, input);
  }

  @Delete('aportes/:aporteId')
  removeAporte(
    @CurrentUser() user: JwtPayload,
    @Param('aporteId', new ParseUUIDPipe()) aporteId: string,
  ) {
    return this.service.removeAporte(user.sub, aporteId);
  }
}
