import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'metas' })
@Index(['userId', 'completada', 'prioridad'])
export class Meta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'nombre', type: 'text' })
  nombre!: string;

  @Column({ name: 'monto_objetivo', type: 'bigint' })
  montoObjetivo!: string;

  /** Derivado de los aportes, materializado en la fila. */
  @Column({ name: 'monto_actual', type: 'bigint', default: 0 })
  montoActual!: string;

  @Column({ name: 'fecha_limite', type: 'text' })
  fechaLimite!: string;

  /** 1 es la más importante. */
  @Column({ name: 'prioridad', type: 'integer', default: 1 })
  prioridad!: number;

  /** Lo que el usuario planea apartar cada mes. */
  @Column({ name: 'aporte_mensual', type: 'bigint', default: 0 })
  aporteMensual!: string;

  @Column({ name: 'icono', type: 'text', default: 'Target' })
  icono!: string;

  @Column({ name: 'completada', type: 'boolean', default: false })
  completada!: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
