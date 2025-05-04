import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ClientsModule } from './database/clients/clients.module';
import { PaymentModule } from './database/payment_history/payment_history.module';
import { UsersModule } from './database/users/users.module'
@Module({
  imports: [DatabaseModule, ClientsModule, PaymentModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}