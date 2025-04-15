import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ClientsModule } from './database/clients/clients.module';
import { PaymentModule } from './database/payment_history/payment_history.module';
@Module({
  imports: [DatabaseModule, ClientsModule, PaymentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}