import {
  Controller,
  Post,
  Body,
  Delete,
  Get,
  Query,
  Patch,
  UseGuards,
  HttpException,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { FitnessTestService } from './fitness_test.service';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('fitness_test')
@UseGuards(JwtAuthGuard)
export class FitnessTestController {
  constructor(private readonly fitnessTestService: FitnessTestService) {}

  @Get()
  async getFitnessTestsClient(
    @Query('clientId') clientId: number,
    @Query('nameColumn') nameColumn?: string,
    @Query('table') table?: string,
  ): Promise<any> {
    return this.fitnessTestService.getFitnessTestsClient(clientId, nameColumn, table);
  }

  @Get('fitness_test_exercises')
  async getFitnessTestsClient_exercises(
    @Query('testId') testId: number,
    @Query('nameColumn') nameColumn?: string,
    @Query('table') table?: string,
  ): Promise<any> {
    return this.fitnessTestService.getFitnessTestsClient_exercises(testId, nameColumn, table);
  }

  // Bulk (опционально)
  @Patch()
  async changeFitnessTest(@Body() payload: any) {
    return await this.fitnessTestService.changeFitnessTest(payload);
  }

  // ===== NEW: CREATE EXERCISE =====
  @Post('exercise')
  async createExercise(@Body() payload: any) {
    try {
      return await this.fitnessTestService.createExercise(payload);
    } catch (error) {
      throw new HttpException(
        'Failed to add exercise',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===== NEW: UPDATE EXERCISE =====
  @Patch('exercise/:id')
  async updateExercise(@Param('id') id: string, @Body() payload: any) {
    try {
      return await this.fitnessTestService.updateExercise(Number(id), payload);
    } catch (error) {
      throw new HttpException(
        'Failed to update exercise',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // DELETE single exercise
  @Delete(':id')
  async deleteExerciseById(@Param('id') id: string) {
    try {
      const deleted = await this.fitnessTestService.deleteExerciseById(id);
      if (!deleted?.success) {
        throw new HttpException('Exercise not found', HttpStatus.NOT_FOUND);
      }
      return { success: true };
    } catch (error) {
      throw new HttpException('Failed to delete exercise', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('deleteTest/:id')
  async deleteTestById(@Param('id') id: string) {
    try {
      const deleted = await this.fitnessTestService.deleteTestById(id);
      if (!deleted) {
        throw new HttpException('Test not found', HttpStatus.NOT_FOUND);
      }
      return { success: true };
    } catch (error) {
      throw new HttpException('Failed to deleteTest', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('changeNameTest/:id')
  async changeNameTest(@Param('id') id: string, @Body() newName: any) {
    try {
      await this.fitnessTestService.changeNameTest(newName, id);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        'Failed to change NameTest',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('newTest')
  async createNewFitnessTest(@Body() payload: any) {
    return await this.fitnessTestService.createNewFitnessTest(payload);
  }
}
