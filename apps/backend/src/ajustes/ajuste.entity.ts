import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type CicloPago = 'mensual' | 'quincenal' | 'semanal';
export type Tema = 'claro' | 'oscuro' | 'sistema';

@Entity({ name: 'ajustes' })
export class Ajuste {
  // La PK es el user_id (una fila por usuario).
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', default: 'MXN' })
  moneda!: string;

  @Column({ type: 'text', default: 'es-MX' })
  locale!: string;

  @Column({ name: 'ingreso_mensual', type: 'bigint', default: 0 })
  ingresoMensual!: string;

  @Column({
    name: 'ciclo_pago',
    type: 'text',
    default: 'quincenal',
  })
  cicloPago!: CicloPago;

  @Column({ name: 'saldo_inicial', type: 'bigint', default: 0 })
  saldoInicial!: string;

  @Column({ name: 'saldo_inicial_fecha', type: 'text', default: '' })
  saldoInicialFecha!: string;

  @Column({ type: 'text', default: 'sistema' })
  tema!: Tema;

  @Column({ type: 'text', default: 'grafito' })
  acento!: string;

  @Column({ name: 'dias_aviso_vencimiento', type: 'integer', default: 7 })
  diasAvisoVencimiento!: number;

  @Column({
    name: 'umbral_precaucion',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0.8,
  })
  umbralPrecaucion!: string;

  @Column({ name: 'notificaciones_activas', type: 'boolean', default: false })
  notificacionesActivas!: boolean;

  @Column({ name: 'ultima_revision_vencimientos', type: 'text', default: '' })
  ultimaRevisionVencimientos!: string;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
