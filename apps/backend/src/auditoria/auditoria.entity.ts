import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AccionAuditoria =
  | 'login_ok'
  | 'login_fallo'
  | 'logout'
  | 'registro'
  | 'verificacion_email'
  | 'reenvio_verificacion'
  | 'cambio_password'
  | 'reset_password'
  | 'olvide_password'
  | 'eliminacion_cuenta'
  | 'logout_all'
  | 'actualizacion_perfil'
  | 'admin_eliminar_usuario'
  | 'admin_forzar_reset'
  | 'admin_cambiar_rol';

/**
 * Bitácora de eventos sensibles de auth. El usuario ve la propia (en
 * /auth/auditoria) y los admins ven la global (futuro).
 *
 * `detalles` es jsonb libre: puede llevar IP, user-agent, motivo, etc.
 * `email_intento` se llena también en fallos de login, para que un admin
 * pueda ver si alguien está probando correos ajenos.
 */
@Entity({ name: 'auditoria' })
@Index(['usuarioId', 'creadoEn'])
@Index(['accion', 'creadoEn'])
export class Auditoria {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId!: string | null;

  @Column({ name: 'email_intento', type: 'text', nullable: true })
  emailIntento!: string | null;

  @Column({ name: 'accion', type: 'varchar', length: 40 })
  accion!: AccionAuditoria;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  detalles!: Record<string, unknown>;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
