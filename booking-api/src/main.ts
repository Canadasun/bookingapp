import 'reflect-metadata';
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.url) event.request.url = event.request.url.split('?')[0];
      if (event.request?.cookies) event.request.cookies = {};
      if (event.request?.headers) {
        delete event.request.headers['cookie'];
        delete event.request.headers['Cookie'];
        delete event.request.headers['authorization'];
        delete event.request.headers['Authorization'];
      }
      return event;
    },
  });
}
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // Fail fast if any secret env var is missing — prevents silent fallback to empty
  // strings (which would allow token forgery in misconfigured deploys).
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'REDIS_URL'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }

  // rawBody: true preserves the unparsed request body on req.rawBody, which the
  // Stripe webhook needs for signature verification (stripe.webhooks.constructEvent).
  // Without it req.rawBody is undefined and every webhook fails the signature check.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  // Trust Railway's / any reverse-proxy's X-Forwarded-For so req.ip reflects
  // the real client IP — required for per-IP rate limiting to work correctly.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());

  // Global CSRF Protection: When the browser sends a request to the /proxy, it 
  // automatically attaches cookies. Since the API accepts cookies for auth, 
  // we must verify that the request was intentional (not a cross-site form 
  // submission) by requiring a custom header that cannot be set cross-origin 
  // without CORS preflight approval.
  app.use((req: any, res: any, next: any) => {
    const hasCookie = !!(req.headers.cookie || req.headers.Cookie);
    const hasAuthHeader = !!(req.headers.authorization || req.headers.Authorization);
    // If authenticated via cookie but missing the custom header, reject it.
    if (hasCookie && !hasAuthHeader && !req.headers['x-requested-with']) {
      return res.status(403).json({ 
        statusCode: 403, 
        message: 'CSRF Protection: X-Requested-With header required' 
      });
    }
    next();
  });

  app.setGlobalPrefix('api', { exclude: ['/'] });
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
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature', 'X-Manage-Token', 'X-Requested-With'],
  });

  // Swagger exposes the full API surface — only mount it outside production.
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Pulse API')
      .setDescription('Appointment booking API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
bootstrap();
