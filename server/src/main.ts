import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ✅ Раздача статики
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));


  // ✅ CORS
  const allowedOrigins = [
    'http://localhost:3000', // React dev
    'https://your-prod-frontend.com', // продакшен-домен, если есть
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // ✅ Запуск
  const PORT = 5000;
  await app.listen(PORT);
  console.log(`Сервер запущен на http://localhost:${PORT}`);
}
bootstrap();
