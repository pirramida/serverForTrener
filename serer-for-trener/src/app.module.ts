import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ClientsModule } from './database/clients/clients.module';

@Module({
  imports: [DatabaseModule, ClientsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}