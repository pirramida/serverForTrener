import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [ClientsService, DatabaseService],
  controllers: [ClientsController],
})
export class ClientsModule {}
