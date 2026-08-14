import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RolUsuario = 'usuario' | 'admin';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'text', default: '' })
  displayName!: string;

  @Column({ name: 'email_verificado', type: 'boolean', default: false })
  emailVerificado!: boolean;

  @Column({ name: 'email_verificado_en', type: 'timestamptz', nullable: true })
  emailVerificadoEn!: Date | null;

  /**
   * Cada vez que el usuario hace "cerrar sesión en todos los dispositivos"
   * o cambia su password, este contador sube. El JWT lleva el `tokenVersion`
   * con el que se emitió; si en la BD ya es mayor, el token queda inválido.
   */
  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion!: number;

  @Column({ name: 'rol', type: 'varchar', length: 20, default: 'usuario' })
  rol!: RolUsuario;

  /**
   * Se prende cuando un admin fuerza un reset de password. El frontend debe
   * detectarlo y mostrar la pantalla de cambio.
   */
  @Column({ name: 'debe_cambiar_password', type: 'boolean', default: false })
  debeCambiarPassword!: boolean;

  @Column({ name: 'password_actualizado_en', type: 'timestamptz', nullable: true })
  passwordActualizadoEn!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
