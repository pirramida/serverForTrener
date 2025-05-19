import { Module } from '@nestjs/common';
import { PaymentService } from './payment_history.service';
import { PaymentController } from './payment_history.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [PaymentService, DatabaseService],
  controllers: [PaymentController],
})
export class PaymentModule { }
