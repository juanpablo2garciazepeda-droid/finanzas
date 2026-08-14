import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard por defecto usa `request.ip`. Detrás de Traefik, `app.set(
 * 'trust proxy', true)` hace que `request.ip` sea la IP real del cliente
 * (la del header `X-Forwarded-For` que Traefik reescribe), no la del
 * proxy. Sin más override el bucket ya es por usuario.
 *
 * Esta subclase existe solo para tener un punto de extensión claro si en
 * el futuro hay que identificar el bucket por algo distinto a la IP
 * (p. ej. un header `X-Tenant`).
 */
@Injectable()
export class ThrottlerBackendGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve((req.ip as string | undefined) ?? 'unknown');
  }
}
