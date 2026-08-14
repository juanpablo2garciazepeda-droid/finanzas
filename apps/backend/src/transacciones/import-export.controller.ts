import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Categoria } from '../categorias/categoria.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { UsersService } from '../users/users.service';

interface FilaImportada {
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  categoria: string;
  metodoPago: 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';
  nota?: string;
}

const METODOS_VALIDOS = new Set(['efectivo', 'debito', 'credito', 'transferencia', 'otro'])

/**
 * Importar / exportar.
 *
 * Importar acepta un CSV con headers:
 *   fecha,tipo,monto,categoria,metodoPago,nota
 * - fecha: YYYY-MM-DD
 * - tipo: ingreso|egreso
 * - monto: número (se interpreta como pesos, multiplicamos por 100 para centavos)
 * - categoria: nombre exacto de una categoría existente del usuario. Si no
 *   existe, la creamos como "sistema" del usuario.
 * - metodoPago: efectivo|debito|credito|transferencia|otro
 * - nota: opcional
 *
 * Exportar devuelve TODO lo del usuario en un JSON (LFPDPPP): categorías,
 * transacciones, presupuestos, deudas, pagos, metas, aportes, ajustes,
 * recurrentes. El usuario lo descarga y se queda con su copia.
 */
@UseGuards(AuthGuard('jwt'))
@Controller('datos')
export class ImportExportController {
  constructor(
    @InjectRepository(Categoria) private readonly categorias: Repository<Categoria>,
    @InjectRepository(Transaccion) private readonly transacciones: Repository<Transaccion>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('exportar')
  async exportar(@CurrentUser() user: JwtPayload) {
    const categorias = await this.categorias.find({ where: { userId: user.sub } })
    const transacciones = await this.transacciones.find({ where: { userId: user.sub } })
    const presupuestos = await this.dataSource.getRepository('presupuestos').find({ where: { userId: user.sub } })
    const deudas = await this.dataSource.getRepository('deudas').find({ where: { userId: user.sub } })
    const pagos = await this.dataSource.getRepository('pagos_deuda').find({ where: { userId: user.sub } })
    const metas = await this.dataSource.getRepository('metas').find({ where: { userId: user.sub } })
    const aportes = await this.dataSource.getRepository('aportes_meta').find({ where: { userId: user.sub } })
    const ajustes = await this.dataSource.getRepository('ajustes').findOne({ where: { userId: user.sub } })
    const recurrentes = await this.dataSource.getRepository('gastos_recurrentes').find({
      where: { userId: user.sub },
    })
    const u = await this.usersService.findByIdOrThrow(user.sub)
    return {
      generadoEn: new Date().toISOString(),
      usuario: {
        email: u.email,
        displayName: u.displayName,
        idioma: u.idioma,
        creadoEn: u.createdAt.toISOString(),
      },
      categorias,
      transacciones,
      presupuestos,
      deudas,
      pagos,
      metas,
      aportes,
      ajustes,
      recurrentes,
    }
  }

  @Post('importar-csv')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importarCsv(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ) {
    if (!archivo) throw new BadRequestException('Falta el archivo.')
    const texto = archivo.buffer.toString('utf8')
    const filas = this.parsearCsv(texto)
    if (filas.length === 0) {
      throw new BadRequestException('El archivo no tiene filas válidas.')
    }
    // Cache de categorías para no pegarle a la BD por cada fila.
    const categoriasUsuario = await this.categorias.find({ where: { userId: user.sub } })
    const cacheNombre = new Map<string, Categoria>()
    for (const c of categoriasUsuario) {
      cacheNombre.set(c.nombre.toLowerCase(), c)
    }
    const creadas: string[] = []
    const errores: string[] = []
    let insertadas = 0

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < filas.length; i++) {
        const fila = filas[i]
        const filaIdx = i + 2 // considerando header
        if (!fila.fecha || !fila.tipo || !fila.monto) {
          errores.push(`Fila ${filaIdx}: faltan campos requeridos.`)
          continue
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fila.fecha)) {
          errores.push(`Fila ${filaIdx}: fecha inválida (${fila.fecha}).`)
          continue
        }
        if (fila.tipo !== 'ingreso' && fila.tipo !== 'egreso') {
          errores.push(`Fila ${filaIdx}: tipo inválido (${fila.tipo}).`)
          continue
        }
        if (!METODOS_VALIDOS.has(fila.metodoPago)) {
          errores.push(`Fila ${filaIdx}: método de pago inválido (${fila.metodoPago}).`)
          continue
        }
        if (fila.monto <= 0) {
          errores.push(`Fila ${filaIdx}: monto debe ser > 0.`)
          continue
        }
        let cat = cacheNombre.get((fila.categoria || '').toLowerCase())
        if (!cat) {
          const colorPorTipo = fila.tipo === 'ingreso' ? '#10924B' : '#E2484F'
          cat = manager.create(Categoria, {
            userId: user.sub,
            nombre: fila.categoria || 'Sin categoría',
            tipo: fila.tipo,
            icono: 'Ellipsis',
            color: colorPorTipo,
            esSistema: false,
            archivada: false,
            orden: 999,
          })
          cat = await manager.save(cat)
          cacheNombre.set(cat.nombre.toLowerCase(), cat)
          creadas.push(cat.nombre)
        }
        await manager.insert(Transaccion, {
          userId: user.sub,
          tipo: fila.tipo,
          monto: String(Math.round(fila.monto * 100)), // pesos → centavos
          categoriaId: cat.id,
          fecha: fila.fecha,
          metodoPago: fila.metodoPago,
          nota: fila.nota ?? '',
        })
        insertadas++
      }
    })

    return {
      insertadas,
      categoriasCreadas: creadas,
      errores,
    }
  }

  /**
   * Parser CSV minimalista: soporta comillas dobles para escapar campos
   * con coma, no soporta saltos de línea dentro de comillas (sería raro en
   * un export de gastos).
   */
  private parsearCsv(texto: string): FilaImportada[] {
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
    if (lineas.length < 2) return []
    const headers = this.parsearLineaCsv(lineas[0]).map((h) => h.toLowerCase())
    const idx = (k: string) => headers.indexOf(k)
    const iF = idx('fecha')
    const iT = idx('tipo')
    const iM = idx('monto')
    const iC = idx('categoria')
    const iP = idx('metodopago')
    const iN = idx('nota')
    if (iF < 0 || iT < 0 || iM < 0 || iC < 0) {
      throw new BadRequestException('Headers requeridos: fecha, tipo, monto, categoria.')
    }
    const filas: FilaImportada[] = []
    for (let i = 1; i < lineas.length; i++) {
      const campos = this.parsearLineaCsv(lineas[i])
      const tipoRaw = (campos[iT] || '').toLowerCase().trim()
      const tipo: 'ingreso' | 'egreso' = tipoRaw === 'ingreso' ? 'ingreso' : 'egreso'
      filas.push({
        fecha: campos[iF]?.trim() || '',
        tipo,
        monto: Number(campos[iM]?.replace(/[$,\s]/g, '') || 0),
        categoria: campos[iC]?.trim() || '',
        metodoPago: ((campos[iP] || 'otro').toLowerCase().trim() as FilaImportada['metodoPago']),
        nota: iN >= 0 ? campos[iN]?.trim() : '',
      })
    }
    return filas
  }

  private parsearLineaCsv(linea: string): string[] {
    const resultado: string[] = []
    let actual = ''
    let dentro = false
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i]
      if (c === '"') {
        if (dentro && linea[i + 1] === '"') {
          actual += '"'
          i++
        } else {
          dentro = !dentro
        }
      } else if (c === ',' && !dentro) {
        resultado.push(actual)
        actual = ''
      } else {
        actual += c
      }
    }
    resultado.push(actual)
    return resultado
  }
}
