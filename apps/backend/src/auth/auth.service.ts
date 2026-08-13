import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('email already registered');
    }
    const user = await this.users.create(email, password, displayName);
    return this.issue(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('credenciales inválidas');
    }
    const ok = await this.users.verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('credenciales inválidas');
    }
    return this.issue(user);
  }

  private issue(user: User): { accessToken: string; user: PublicUser } {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}
