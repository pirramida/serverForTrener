import { Controller, Get, Post, Body, Delete, Patch } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) { }

  @Get()
  async getClients() {
    return await this.clientsService.getAllClients();
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
  async changeClient(@Body() body: { phoneNumber: any, form: any }) {
    const newClientData = await this.clientsService.changeClient(body.phoneNumber, body.form);
    return { data: newClientData, message: 'Данные пользователя обновлены!' }
  }

  @Patch()
  async changeParametrs(@Body() body: { corrections: any, parameters: any, primary: any }) {
    const newParametrs = await this.clientsService.changeParametrs(body.corrections, body.parameters, body.primary);
    return true;
  }
}
