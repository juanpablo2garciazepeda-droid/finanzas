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

/**
 * Tope duro de la foto de perfil, en caracteres del data URL.
 *
 * El cliente manda un JPEG de 256×256 con calidad 0.85, que ronda los 25 KB
 * (~34 000 caracteres en base64). 400 000 deja margen de sobra para fotos con
 * mucho detalle sin permitir que alguien use la columna como disco duro.
 */
export const LARGO_MAX_FOTO = 400_000;

/** `data:image/jpeg;base64,…` y nada más: ni SVG (ejecuta script) ni URLs remotas. */
export const PATRON_FOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

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

  @IsOptional()
  @IsString()
  @MaxLength(LARGO_MAX_FOTO, { message: 'La foto es demasiado grande.' })
  @Matches(PATRON_FOTO, { message: 'Formato de foto no admitido.' })
  fotoUrl?: string;
}

/**
 * Canje del código de 6 dígitos que llega por correo. Va con el email porque
 * en este punto todavía no hay sesión: el código solo identifica al usuario
 * en combinación con la cuenta que lo pidió.
 */
export class VerificarCodigoDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos.' })
  codigo!: string;
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

  /** Cadena vacía = quitar la foto y volver a la inicial. */
  @IsOptional()
  @IsString()
  @MaxLength(LARGO_MAX_FOTO, { message: 'La foto es demasiado grande.' })
  @Matches(new RegExp(`^$|${PATRON_FOTO.source}`), {
    message: 'Formato de foto no admitido.',
  })
  fotoUrl?: string;
}

export class EliminarCuentaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
