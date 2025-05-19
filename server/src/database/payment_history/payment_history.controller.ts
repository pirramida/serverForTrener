import { Controller, Get, Post, Body, Delete, Patch } from '@nestjs/common';
import { PaymentService } from './payment_history.service';

@Controller('payment_history')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Get()
    async getPaymentHistory() {
        return await this.paymentService.getAllPaymentHistory();
    }

    @Post()
    async postNewPaymentHistory(@Body() body: { fromData: any }) {
        try {
            const response = await this.paymentService.postNewPaymentHistory(body.fromData);
            return { message: 'Успешно!', data: response }
        } catch (error) {
            return { message: error };
        }
    }

    @Patch('/quantity')
    async getQuantity(@Body() client: any) {
        return await this.paymentService.getQuantity(client);
    }

    @Patch()
    async changeSessionsClient(@Body() body: { client: any, payload: any }) {
        try {
            const response = await this.paymentService.changeSessionsClient(body.client, body.payload);
            if (response) {
                return { status: true, data: response }
            }
            return { status: false }

        } catch (error) {
            return { message: error }

        }
    }

    //   @Post()
    //   async addClient(@Body() body: { form: any}) {
    //     await this.paymentService.addClient(body.form);
    //     return { message: 'Клиент добавлен' };
    //   }

    //   @Delete()
    //   async deleteClient(@Body() body: { phoneNumber: any }) {
    //     await this.paymentService.deleteClient(body.phoneNumber);
    //     return { message: 'Клиент удален!' };
    //   }

    //   @Patch()
    //   async changeClient(@Body() body: { phoneNumber: any, form: any }) {
    //     const newClientData = await this.paymentService.changeClient(body.phoneNumber, body.form);
    //     return { data: newClientData, message: 'Данные пользователя обновлены!' }
    //   }
}
