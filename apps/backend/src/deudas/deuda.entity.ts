import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'deudas' })
@Index(['userId', 'liquidada', 'fechaLimite'])
export class Deuda {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'acreedor', type: 'text' })
  acreedor!: string;

  @Column({ name: 'monto_original', type: 'bigint' })
  montoOriginal!: string;

  @Column({ name: 'saldo_actual', type: 'bigint' })
  saldoActual!: string;

  /** Porcentaje anual. null cuando no aplica o no se conoce. */
  @Column({ name: 'tasa_interes', type: 'numeric', precision: 6, scale: 2, nullable: true })
  tasaInteres!: string | null;

  @Column({ name: 'fecha_limite', type: 'text' })
  fechaLimite!: string;

  @Column({ name: 'periodicidad', type: 'text' })
  periodicidad!: 'semanal' | 'quincenal' | 'mensual' | 'unico';

  @Column({ name: 'pago_minimo', type: 'bigint', default: 0 })
  pagoMinimo!: string;

  @Column({ type: 'boolean', default: false })
  liquidada!: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
