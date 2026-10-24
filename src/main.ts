import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { bufferLogs: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  // Sin cookies: el token viaja en Authorization. Métodos explícitos (el default omite PUT/PATCH/DELETE).
  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`API escuchando en :${port}`, 'Bootstrap');
}

void bootstrap();
