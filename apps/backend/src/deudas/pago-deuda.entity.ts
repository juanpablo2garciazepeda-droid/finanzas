import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'pagos_deuda' })
@Index(['userId', 'deudaId', 'fecha'])
export class PagoDeuda {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'deuda_id', type: 'uuid' })
  deudaId!: string;

  @Column({ type: 'bigint' })
  monto!: string;

  @Column({ type: 'text' })
  fecha!: string;

  @Column({ type: 'text', default: '' })
  nota!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
