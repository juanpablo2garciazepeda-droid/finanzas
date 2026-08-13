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

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ name: 'monto_objetivo', type: 'bigint' })
  montoObjetivo!: string;

  @Column({ name: 'fecha_limite', type: 'text', default: '' })
  fechaLimite!: string;

  @Column({ type: 'integer', default: 0 })
  prioridad!: number;

  @Column({ type: 'boolean', default: false })
  completada!: boolean;

  @Column({ type: 'text', default: '' })
  nota!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
