import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async create(email: string, password: string, displayName: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.users.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      emailVerificado: false,
      emailVerificadoEn: null,
      tokenVersion: 0,
      rol: 'usuario',
      debeCambiarPassword: false,
      passwordActualizadoEn: new Date(),
    });
    return this.users.save(user);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Sube el `tokenVersion` del usuario, lo que invalida todos los JWT
   * que se emitieron con la versión anterior. Se usa en:
   *   · cambio de password
   *   · "cerrar sesión en todos los dispositivos"
   *   · reset de password vía email
   */
  async incrementarTokenVersion(userId: string): Promise<void> {
    await this.users.increment({ id: userId }, 'tokenVersion', 1);
  }

  async marcarEmailVerificado(userId: string): Promise<void> {
    await this.users.update(
      { id: userId },
      { emailVerificado: true, emailVerificadoEn: new Date() },
    );
  }

  async actualizarPassword(userId: string, nuevoHash: string): Promise<void> {
    await this.users.update(
      { id: userId },
      {
        passwordHash: nuevoHash,
        passwordActualizadoEn: new Date(),
        debeCambiarPassword: false,
      },
    );
  }

  async actualizarPerfil(
    userId: string,
    cambios: { displayName?: string },
  ): Promise<User> {
    const user = await this.findByIdOrThrow(userId);
    if (cambios.displayName !== undefined) {
      user.displayName = cambios.displayName;
    }
    return this.users.save(user);
  }

  async eliminar(userId: string): Promise<void> {
    // ON DELETE CASCADE se encarga del resto (categorías, transacciones, etc.)
    await this.users.delete({ id: userId });
  }
}
