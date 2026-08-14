import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Código de 6 dígitos que confirma un correo ANTES de que exista la cuenta.
 *
 * Se identifica por el correo y no por un `usuario_id` porque en este punto no
 * hay usuario: esa es justamente la diferencia con `TokenVerificacion`, cuya
 * columna `usuario_id` es NOT NULL con llave foránea.
 */
@Entity({ name: 'codigos_registro' })
@Index(['email', 'creadoEn'])
export class CodigoRegistro {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  email!: string;

  /** SHA-256 del código. Nunca se guarda en claro. */
  @Column({ name: 'codigo_hash', type: 'text' })
  codigoHash!: string;

  /** Intentos fallidos. A los 6, el código se da por quemado. */
  @Column({ type: 'integer', default: 0 })
  intentos!: number;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn!: Date;

  @Column({ name: 'usado_en', type: 'timestamptz', nullable: true })
  usadoEn!: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
