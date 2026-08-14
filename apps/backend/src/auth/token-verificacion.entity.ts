import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Token de un solo uso para verificar el email tras el registro.
 * Se guarda solo el hash SHA-256 del token: si un atacante obtiene un dump
 * de la BD no puede activar cuentas.
 */
@Entity({ name: 'tokens_verificacion' })
@Index(['usuarioId', 'creadoEn'])
export class TokenVerificacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn!: Date;

  @Column({ name: 'usado_en', type: 'timestamptz', nullable: true })
  usadoEn!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
