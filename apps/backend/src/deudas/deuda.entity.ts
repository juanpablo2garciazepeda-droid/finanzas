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

  /**
   * Cuál de los tres hitos de aviso se mandó por correo —`previo`, `hoy` o
   * `vencido`— y a qué vencimiento se refería. La pareja es lo que evita
   * repetir el mismo correo todos los días y, a la vez, lo que hace que un
   * pago mensual vuelva a avisar el mes siguiente: cambia la fecha, así que
   * el hito vuelve a ser nuevo.
   */
  @Column({ name: 'ultimo_aviso_hito', type: 'text', nullable: true })
  ultimoAvisoHito!: 'previo' | 'hoy' | 'vencido' | null;

  @Column({ name: 'ultimo_aviso_fecha', type: 'text', nullable: true })
  ultimoAvisoFecha!: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
