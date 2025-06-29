import { Module } from '@nestjs/common';
import { FitnessTestService } from './fitness_test.service'
import { FitnessTestController } from './fitness_test.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [FitnessTestService, DatabaseService],
  controllers: [FitnessTestController],
})
export class FitnessTestModule {}
