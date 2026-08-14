import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[\p{L}\p{N}\p{M}\s._-]+$/u, {
    message: 'displayName contiene caracteres no permitidos',
  })
  displayName!: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class OlvidePasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class RestablecerPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(20)
  token!: string;
}

export class TokenDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  nuevoEmail?: string;
}

export class CambiarCorreoDto {
  @IsEmail()
  @MaxLength(254)
  nuevoEmail!: string;
}

export class CambiarPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  actual!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  nuevo!: string;
}

export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[\p{L}\p{N}\p{M}\s._-]+$/u, {
    message: 'displayName contiene caracteres no permitidos',
  })
  displayName?: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  idioma?: 'es' | 'en';

  @IsOptional()
  @IsBoolean()
  recibirDigest?: boolean;
}

export class EliminarCuentaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
