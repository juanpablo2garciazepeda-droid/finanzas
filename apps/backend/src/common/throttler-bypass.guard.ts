import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard por defecto usa `request.ip`. Detrás de Traefik eso es la
 * IP del proxy (siempre la misma) y todo el mundo compartiría contador.
 * Leemos `X-Forwarded-For` que es la IP real del cliente.
 */
@Injectable()
export class ThrottlerBackendGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    const fwd = headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) {
      return Promise.resolve(fwd.split(',')[0].trim());
    }
    const real = headers['x-real-ip'];
    if (typeof real === 'string' && real.length) return Promise.resolve(real);
    const ip = (req.ip as string | undefined) ?? 'unknown';
    return Promise.resolve(ip);
  }
}
