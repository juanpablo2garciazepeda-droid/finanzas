import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'presupuestos' })
@Index(['userId', 'periodo'])
export class Presupuesto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // null = presupuesto global del mes
  @Column({ name: 'categoria_id', type: 'uuid', nullable: true })
  categoriaId!: string | null;

  @Column({ name: 'monto_limite', type: 'bigint' })
  montoLimite!: string;

  @Column({ type: 'text' })
  periodo!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
