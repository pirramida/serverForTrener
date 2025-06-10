import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as https from 'https';

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync(join(__dirname, '..', 'ssl', 'key.pem')),
    cert: fs.readFileSync(join(__dirname, '..', 'ssl', 'cert.pem')),
  };

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });

  // ✅ Раздача статики
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // ✅ cookie-parser
  app.use(cookieParser());

  // ✅ CORS
  const allowedOrigins = [
    'http://localhost:3000', // React dev
    'http://localhost:3002', // React dev
    'https://your-prod-frontend.com', // uncomment for prod
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
  console.log(`Сервер запущен на https://localhost:${PORT}`);
}
bootstrap();
