import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { DatabaseService } from '../database.service';

@Module({
  providers: [ReportService, DatabaseService],
  controllers: [ReportController],
})
export class ReportModule { }
