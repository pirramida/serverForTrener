import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Patch,
  Query,
} from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
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
}
