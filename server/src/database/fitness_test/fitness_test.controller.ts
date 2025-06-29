import {
  Controller,
  Post,
  Body,
  Delete,
  Put,
  Get,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FitnessTestService } from './fitness_test.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('fitness_test')
@UseGuards(JwtAuthGuard)
export class FitnessTestController {
  jwtService: any;
  constructor(private readonly fitnessTestService: FitnessTestService) { }

  
}
