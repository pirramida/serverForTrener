import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [UsersService, DatabaseService],
  controllers: [UsersController],
})
export class UsersModule {}
