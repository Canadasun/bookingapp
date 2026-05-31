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

  // Allowlist origins from env (comma-separated), falling back to NEXT_PUBLIC_WEB_URL.
  // If neither is set we reflect the request origin so local dev / curl / Swagger
  // keep working. In production set CORS_ALLOWED_ORIGINS to your web URL(s).
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  });

  const config = new DocumentBuilder()
    .setTitle('BookingApp API')
    .setDescription('Appointment booking API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`\n🚀  API running on http://localhost:${port}/api`);
  console.log(`📖  Swagger   http://localhost:${port}/docs\n`);
}
bootstrap();
