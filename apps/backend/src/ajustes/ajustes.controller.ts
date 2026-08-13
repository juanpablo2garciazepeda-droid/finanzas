import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AjustesService } from './ajustes.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { Ajuste } from './ajuste.entity';

@Controller('ajustes')
@UseGuards(AuthGuard('jwt'))
export class AjustesController {
  constructor(private readonly service: AjustesService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.service.getOrCreate(user.sub);
  }

  @Patch()
  update(
    @CurrentUser() user: JwtPayload,
    @Body() input: Partial<Ajuste>,
  ) {
    return this.service.update(user.sub, input);
  }
}
