import { Controller, Get, Post, Body } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async getClients() {
    return await this.clientsService.getAllClients();
  }

  @Post()
  async addClient(@Body() body: { name: string; email: string; phone: string }) {
    await this.clientsService.addClient(body.name, body.email, body.phone);
    return { message: 'Клиент добавлен' };
  }
}
