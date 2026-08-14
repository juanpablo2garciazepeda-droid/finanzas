import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TipoMovimiento = 'ingreso' | 'egreso';
export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';

/**
 * Plantilla de transacción periódica.
 *
 * El backend, al hacer login o refrescar, mira cada recurrente activo del
 * usuario y, si toca una ocurrencia nueva según `dia_del_mes` y la fecha
 * actual, inserta la transacción en `transacciones` y guarda
 * `ultimo_generado_en` para no duplicar.
 */
@Entity({ name: 'gastos_recurrentes' })
@Index(['userId', 'activo'])
export class GastoRecurrente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  tipo!: TipoMovimiento;

  @Column({ type: 'bigint' })
  monto!: string; // bigint viene como string en JSON

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @Column({ name: 'metodo_pago', type: 'text' })
  metodoPago!: MetodoPago;

  @Column({ type: 'text', default: '' })
  nota!: string;

  @Column({ name: 'dia_del_mes', type: 'integer' })
  diaDelMes!: number;

  @Column({ name: 'inicia_en', type: 'text' })
  iniciaEn!: string;

  @Column({ name: 'termina_en', type: 'text', nullable: true })
  terminaEn!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'ultimo_generado_en', type: 'text', nullable: true })
  ultimoGeneradoEn!: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
