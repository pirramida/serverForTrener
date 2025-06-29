import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class FitnessTestService {
  constructor(private readonly databaseService: DatabaseService) { }

}
