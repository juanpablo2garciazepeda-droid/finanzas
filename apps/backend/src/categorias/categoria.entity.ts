import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'categorias' })
@Index(['userId', 'orden'])
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'text' })
  tipo!: 'ingreso' | 'egreso';

  @Column({ type: 'text' })
  icono!: string;

  @Column({ type: 'text' })
  color!: string;

  @Column({ name: 'es_sistema', type: 'boolean', default: false })
  esSistema!: boolean;

  @Column({ type: 'boolean', default: false })
  archivada!: boolean;

  @Column({ type: 'integer', default: 0 })
  orden!: number;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
