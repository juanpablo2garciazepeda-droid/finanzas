import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'aportes_meta' })
@Index(['userId', 'metaId', 'fecha'])
export class AporteMeta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'meta_id', type: 'uuid' })
  metaId!: string;

  @Column({ type: 'bigint' })
  monto!: string;

  @Column({ type: 'text' })
  fecha!: string;

  @Column({ type: 'text', default: '' })
  nota!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
