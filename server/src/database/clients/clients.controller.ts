import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  jwtService: any;
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async getClients() {
    return await this.clientsService.getAllClients();
  }

  @Get('/customGet')
  async customGet(
    @Query('clientId') clientId: number,
    @Query('nameColoumn') nameColoumn?: string,
  ): Promise<any> {
    return this.clientsService.customGet(clientId, nameColoumn);
  }

  @Post()
  async addClient(@Body() body: { form: any }) {
    await this.clientsService.addClient(body.form);
    return { message: 'Клиент добавлен' };
  }

  @Delete()
  async deleteClient(@Body() body: { phoneNumber: any }) {
    await this.clientsService.deleteClient(body.phoneNumber);
    return { message: 'Клиент удален!' };
  }

  @Patch()
  async changeClient(@Body() body: { phoneNumber: any; form: any }) {
    const newClientData = await this.clientsService.changeClient(
      body.phoneNumber,
      body.form,
    );
    return { data: newClientData, message: 'Данные пользователя обновлены!' };
  }

  @Patch('saveClientBlock')
  async saveClientBlock(@Body() payload: any) {
    console.log(payload);
    return await this.clientsService.saveClientBlock(payload);
  }

  @Patch('/changeParametrs')
  async changeParametrs(
    @Body()
    body: {
      data: any;

      clientId: number;
    },
  ) {
    const newParametrs = await this.clientsService.changeParametrs(
      body.data.corrections,
      body.data.parameters,
      body.data.primary,
      body.clientId,
    );
    return newParametrs;
  }

  @Patch('/clientStatistic')
  async clientStatistic(@Body() body: { clientId: number }) {
    const response = await this.clientsService.clientStatistic(body.clientId);
    return response;
  }

  @Patch('stepsAndCalories')
  async saveStepAndCalories(@Body() body: any) {
    const { userId, clientId, date, steps, calories } = body;

    return this.clientsService.saveStepAndCalories({
      userId,
      clientId,
      date,
      steps,
      calories,
    });
  }

  @Patch('stepsAndCalories')
  async patchStepsAndCalories(@Body() body: any) {
    return await this.clientsService.saveStepAndCalories(body);
  }

  @Get('stepsAndCalories')
  async getStepsAndCalories(
    @Query('userId') userId: number,
    @Query('clientId') clientId: number,
  ) {
    return await this.clientsService.getStepAndCalories(userId, clientId);
  }
}
