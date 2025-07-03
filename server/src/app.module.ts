import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ClientsModule } from './database/clients/clients.module';
import { PaymentModule } from './database/payment_history/payment_history.module';
import { UsersModule } from './database/users/users.module'
import { SessionModule } from './database/session_history/session_history.module';
import { ClientsFotoModule } from './database/clients_foto/clients._foto.module';
import { AuthModule } from './auth/Auth.module';
import { JwtService } from '@nestjs/jwt';
import { additionalPaymentsModule } from './database/additional_payments/additional_payments.module';
import { FitnessTestModule } from './database/fitness_test/fitness_test.module';
import { ReportModule } from './database/report/report.module';

@Module({
  imports: [FitnessTestModule, DatabaseModule, ClientsModule, PaymentModule, UsersModule, SessionModule, ClientsFotoModule, AuthModule, additionalPaymentsModule, ReportModule ],
  controllers: [AppController],
  providers: [AppService, JwtService],
})
export class AppModule {}