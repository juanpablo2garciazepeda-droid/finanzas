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

  /**
   * SHA-256 del código de 6 dígitos. Es la alternativa al enlace para quien
   * abre el correo en otro aparato: teclea el código en la pestaña que ya
   * tiene abierta en vez de saltar de dispositivo.
   */
  @Column({ name: 'codigo_hash', type: 'text', nullable: true })
  codigoHash!: string | null;

  /** Intentos fallidos. A los 6, el código se da por quemado. */
  @Column({ name: 'intentos', type: 'integer', default: 0 })
  intentos!: number;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn!: Date;

  @Column({ name: 'usado_en', type: 'timestamptz', nullable: true })
  usadoEn!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
