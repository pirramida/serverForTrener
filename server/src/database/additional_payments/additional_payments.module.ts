import { Module } from '@nestjs/common';
import { additionalPaymentsService } from './additional_payments.service';
import { additionalPaymentsController } from './additional_payments.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [additionalPaymentsService, DatabaseService],
  controllers: [additionalPaymentsController],
})
export class additionalPaymentsModule {}
