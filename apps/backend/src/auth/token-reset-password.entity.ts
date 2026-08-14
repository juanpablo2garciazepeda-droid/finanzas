import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Token de un solo uso para "olvidé mi contraseña".
 * Mismo esquema que TokenVerificacion: se guarda el hash, no el token.
 * Al usarlo (o al expirar) ya no sirve; se puede pedir otro.
 */
@Entity({ name: 'tokens_reset_password' })
@Index(['usuarioId', 'creadoEn'])
export class TokenResetPassword {
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
