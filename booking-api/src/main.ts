import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserves the unparsed request body on req.rawBody, which the
  // Stripe webhook needs for signature verification (stripe.webhooks.constructEvent).
  // Without it req.rawBody is undefined and every webhook fails the signature check.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix('api');
  // Drain connections + run onModuleDestroy (Prisma disconnect, BullMQ workers)
  // on SIGTERM/SIGINT (e.g. Railway redeploys) for a graceful shutdown.
  app.enableShutdownHooks();

  const isProd = process.env.NODE_ENV === 'production';

  // Allowlist origins from env (comma-separated), falling back to NEXT_PUBLIC_WEB_URL.
  // In production we FAIL CLOSED: if nothing is configured, allow no cross-origin
  // requests rather than reflecting any origin with credentials. Outside production
  // we reflect the request origin so local dev / curl / Swagger keep working.
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : !isProd,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  });

  // Swagger exposes the full API surface — only mount it outside production.
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('BookingApp API')
      .setDescription('Appointment booking API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`\n🚀  API running on http://localhost:${port}/api`);
  console.log(`📖  Swagger   http://localhost:${port}/docs\n`);
}
bootstrap();
