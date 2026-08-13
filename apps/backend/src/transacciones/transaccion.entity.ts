import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';

@Entity({ name: 'transacciones' })
@Index(['userId', 'fecha'])
export class Transaccion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  tipo!: 'ingreso' | 'egreso';

  @Column({ type: 'bigint' })
  monto!: string;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @Column({ type: 'text' })
  fecha!: string;

  @Column({ name: 'metodo_pago', type: 'text' })
  metodoPago!: MetodoPago;

  @Column({ type: 'text', default: '' })
  nota!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
