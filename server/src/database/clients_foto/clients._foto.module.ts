import { Module } from '@nestjs/common';
import { ClientsFotoService } from './clients_foto.service';
import { ClientsFotoController } from './clients_foto.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [ClientsFotoService, DatabaseService],
  controllers: [ClientsFotoController],
})
export class ClientsFotoModule {}
