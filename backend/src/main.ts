import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export function configureApp(app: any) {
  app.setGlobalPrefix('api', { exclude: [] });
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  return app;
}

async function bootstrap() {
  for (const k of ['DATABASE_URL', 'JWT_SECRET', 'RECORDING_KEY']) {
    if (!process.env[k]) throw new Error(`${k} 환경변수가 필요해요`);
  }
  const app = configureApp(await NestFactory.create(AppModule));
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('말랑말랑 API').setDescription('발음 연습 서비스 REST API').setVersion('0.1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  await app.listen(Number(process.env.PORT ?? 4000));
}

if (require.main === module) void bootstrap();
