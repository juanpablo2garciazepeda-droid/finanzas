import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearRecurrenteDto {
  @IsIn(['ingreso', 'egreso'])
  tipo!: 'ingreso' | 'egreso';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  monto!: number;

  @IsString()
  categoriaId!: string;

  @IsIn(['efectivo', 'debito', 'credito', 'transferencia', 'otro'])
  metodoPago!: 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';

  @IsOptional()
  @IsString()
  @MaxLength(140)
  nota?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  diaDelMes!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  iniciaEn!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  terminaEn?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarRecurrenteDto {
  @IsOptional()
  @IsIn(['ingreso', 'egreso'])
  tipo?: 'ingreso' | 'egreso';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monto?: number;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsIn(['efectivo', 'debito', 'credito', 'transferencia', 'otro'])
  metodoPago?: 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';

  @IsOptional()
  @IsString()
  @MaxLength(140)
  nota?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  diaDelMes?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  iniciaEn?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  terminaEn?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
