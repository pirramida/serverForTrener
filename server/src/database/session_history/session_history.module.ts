import { Module } from '@nestjs/common';
import { SessionService } from './session_history.service';
import { SessionController } from './session_history.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [SessionService, DatabaseService],
  controllers: [SessionController],
})
export class SessionModule { }
