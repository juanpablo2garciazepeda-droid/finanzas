import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Confiamos en X-Forwarded-For de Traefik para que el throttler y
  // `request.ip` reflejen la IP real del cliente, no del proxy.
  app.set('trust proxy', true);

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? [
      'https://finanzasgz.com.mx',
      'http://localhost:5173',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`finanzas-backend listening on :${port}`);
}

void bootstrap();
