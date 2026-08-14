import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { RecurrentesModule } from '../recurrentes/recurrentes.module';
import { DigestModule } from '../digest/digest.module';
import { EmailModule } from './email.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TokenVerificacion } from './token-verificacion.entity';
import { TokenResetPassword } from './token-reset-password.entity';

@Module({
  imports: [
    UsersModule,
    AuditoriaModule,
    RecurrentesModule,
    DigestModule,
    EmailModule,
    PassportModule,
    TypeOrmModule.forFeature([TokenVerificacion, TokenResetPassword]),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '30d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
