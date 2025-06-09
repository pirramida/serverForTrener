import { Controller, Get, Post, Body, Delete, Patch, Query } from '@nestjs/common';
import { PaymentService } from './payment_history.service';
import { AnyARecord } from 'dns';

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

}
