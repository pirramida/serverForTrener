import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin.includes('localhost')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  await app.listen(5000);                                 // uncomment for prods
  console.log('Сервер запущен на http://localhost:5000'); // uncomment for prods

  // await app.listen(5000, '0.0.0.0');
  // console.log('Сервер запущен и доступен в сети');
}
bootstrap();
