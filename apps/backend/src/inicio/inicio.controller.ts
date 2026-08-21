import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AporteMeta } from '../metas/aporte-meta.entity';
import { Categoria } from '../categorias/categoria.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Meta } from '../metas/meta.entity';
import { PagoDeuda } from '../deudas/pago-deuda.entity';
import { Presupuesto } from '../presupuestos/presupuesto.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { GastoRecurrente } from '../recurrentes/gasto-recurrente.entity';
import { AjustesService } from '../ajustes/ajustes.service';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Hand-rolled porque `AuthCrudService` no cubre ajustes, que es singleton
 * por userId. Si en el futuro se separa esto, el controller queda igual.
 */
@Controller('inicio')
@UseGuards(AuthGuard('jwt'))
export class InicioController {
  constructor(
    private readonly ajustesService: AjustesService,
    @InjectRepository(Categoria) private readonly catRepo: Repository<Categoria>,
    @InjectRepository(Transaccion) private readonly trxRepo: Repository<Transaccion>,
    @InjectRepository(Presupuesto) private readonly preRepo: Repository<Presupuesto>,
    @InjectRepository(Deuda) private readonly deuRepo: Repository<Deuda>,
    @InjectRepository(PagoDeuda) private readonly pagRepo: Repository<PagoDeuda>,
    @InjectRepository(Meta) private readonly metRepo: Repository<Meta>,
    @InjectRepository(AporteMeta) private readonly apoRepo: Repository<AporteMeta>,
    @InjectRepository(GastoRecurrente) private readonly recRepo: Repository<GastoRecurrente>,
  ) {}

  /**
   * El Tablero se recarga en cada foco de pestaña y al volver de background.
   * `default 100/60s` ya cubre 1.6 req/s, más que suficiente para una persona
   * haciendo clic, sin abrir la puerta a un scraper.
   */
  @Get()
  @SkipThrottle({ default: true })
  async cargar(@CurrentUser() { sub }: JwtPayload) {
    const userId = sub;
    const [
      ajustes,
      categorias,
      transacciones,
      presupuestos,
      deudas,
      metas,
      pagos,
      aportes,
      recurrentes,
    ] = await Promise.all([
      this.ajustesService.getOrCreate(userId),
      this.catRepo.find({ where: { userId }, order: { nombre: 'ASC' } }),
      this.trxRepo.find({ where: { userId }, order: { fecha: 'DESC' } }),
      this.preRepo.find({ where: { userId } }),
      this.deuRepo.find({ where: { userId }, order: { creadoEn: 'ASC' } }),
      this.metRepo.find({ where: { userId }, order: { creadoEn: 'ASC' } }),
      this.pagRepo.find({ where: { userId }, order: { fecha: 'DESC' } }),
      this.apoRepo.find({ where: { userId }, order: { fecha: 'DESC' } }),
      // Las plantillas activas son compromisos con fecha: el margen las
      // necesita para devengar la renta antes de que el cargo ocurra.
      this.recRepo.find({ where: { userId }, order: { diaDelMes: 'ASC' } }),
    ]);
    return {
      ajustes,
      categorias,
      transacciones,
      presupuestos,
      deudas,
      metas,
      pagos,
      aportes,
      recurrentes,
    };
  }
}
