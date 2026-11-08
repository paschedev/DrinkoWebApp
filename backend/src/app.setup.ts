import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { rejectCrossSiteWrites } from './common/security/cross-site.middleware';

// Configuración compartida entre main.ts y los tests.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  // Detrás de los proxies de Vercel y Railway: la IP del cliente viene en X-Forwarded-For.
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  // Encabezados de seguridad (nosniff, no embeber en iframes, sin X-Powered-By, etc.).
  app.use(helmet());
  // CORS no se habilita: el frontend llama a /api desde su mismo dominio (rewrite de
  // Next.js), así que ninguna página de otro origen puede leer las respuestas.
  app.use(rejectCrossSiteWrites);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
