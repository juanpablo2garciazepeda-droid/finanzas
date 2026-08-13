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

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ name: 'monto_original', type: 'bigint' })
  montoOriginal!: string;

  @Column({ name: 'tasa_interes_anual', type: 'numeric', precision: 6, scale: 4, default: 0 })
  tasaInteresAnual!: string;

  @Column({ name: 'fecha_limite', type: 'text' })
  fechaLimite!: string;

  @Column({ type: 'boolean', default: false })
  liquidada!: boolean;

  @Column({ type: 'text', default: '' })
  nota!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
