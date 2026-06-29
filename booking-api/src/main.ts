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
  const isProdEnv = process.env.NODE_ENV === 'production';

  // Fail fast if any secret env var is missing — prevents silent fallback to empty
  // strings (which would allow token forgery in misconfigured deploys).
  const required = [
    'JWT_SECRET', 'JWT_REFRESH_SECRET',
    'DATABASE_URL', 'REDIS_URL',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
  ];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }

  // Refuse to start in production with debug/testing overrides active.
  // These flags disable brute-force lockout and plan enforcement respectively —
  // leaving either set in a live environment is a critical misconfiguration.
  if (isProdEnv && process.env.DISABLE_AUTH_LOCKOUT === 'true') {
    throw new Error('DISABLE_AUTH_LOCKOUT=true is not allowed in production. Remove this variable before deploying.');
  }
  if (isProdEnv && process.env.UNLOCK_ALL_FEATURES === 'true') {
    throw new Error('UNLOCK_ALL_FEATURES=true is not allowed in production. Remove this variable before deploying.');
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
  // CSRF only applies to state-changing methods. Safe methods (GET/HEAD/OPTIONS)
  // must not mutate state, and the same-origin policy stops an attacker from
  // reading their cross-origin responses — so enforcing the header there only
  // breaks legitimate cookie-bearing GETs (images, iframes, the ws-ticket fetch)
  // without adding protection. OPTIONS is the CORS preflight and is handled by
  // enableCors below.
  const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  app.use((req: any, res: any, next: any) => {
    if (CSRF_SAFE_METHODS.has(String(req.method).toUpperCase())) return next();
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

  const isProd = isProdEnv;

  // Allowlist origins from env (comma-separated), falling back to NEXT_PUBLIC_WEB_URL.
  // In production we FAIL CLOSED: if nothing is configured, allow no cross-origin
  // requests rather than reflecting any origin with credentials. Outside production
  // we reflect the request origin so local dev / curl / Swagger keep working.
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const adminPanelUrl = (process.env.ADMIN_PANEL_URL ?? process.env.ADMIN_DOMAIN ?? '').trim() || null;
  const allCorsOrigins = adminPanelUrl ? [...corsOrigins, adminPanelUrl] : corsOrigins;
  app.enableCors({
    origin: allCorsOrigins.length ? allCorsOrigins : !isProd,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature', 'X-Manage-Token', 'X-Requested-With'],
  });

  // Origin-route isolation: once a dedicated admin subdomain is live, prevent that
  // origin from hitting non-admin routes (reduces blast radius of a stolen admin token
  // being replayed against tenant endpoints). The reverse restriction — blocking the
  // main web origin from /api/admin/* — is intentionally NOT applied here because the
  // admin UI currently lives on the same www domain. Re-enable when admin moves to its
  // own subdomain and the main web origin no longer needs admin API access.
  if (adminPanelUrl && isProd) {
    app.use((req: any, res: any, next: any) => {
      if (req.method === 'OPTIONS') return next();
      const origin: string | undefined = req.headers.origin;
      const normalizedAdminOrigin = adminPanelUrl.startsWith('https://') ? adminPanelUrl : `https://${adminPanelUrl}`;
      const isAdminOrigin = origin === adminPanelUrl || origin === normalizedAdminOrigin;
      const isAdminPath: boolean = (req.path as string).startsWith('/api/admin');
      if (isAdminOrigin && !isAdminPath) {
        return res.status(403).json({ statusCode: 403, message: 'Admin panel origin may only access /api/admin routes' });
      }
      next();
    });
  }

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
