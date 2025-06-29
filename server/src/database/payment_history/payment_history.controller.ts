import { Controller, Get, Post, Body, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment_history.service';
import { AnyARecord } from 'dns';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('payment_history')
@UseGuards(JwtAuthGuard)
export class PaymentController {
    jwtService: any;
    constructor(private readonly paymentService: PaymentService) { }

    @Get()
    async getPaymentHistory() {
        return await this.paymentService.getAllPaymentHistory();
    }

    @Post()
    async postNewPaymentHistory(@Body() body: { fromData: any, userId: number }) {
        try {
            const response = await this.paymentService.postNewPaymentHistory(body.fromData, body.userId);
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
    async changeSessionsClient(@Body() body: { client: any, payload: any, userId: number }) {
        try {
            const response = await this.paymentService.changeSessionsClient(body.client, body.payload, body.userId);
            if (response) {
                return { status: true, data: response }
            }
            return { status: false }

        } catch (error) {
            return { message: error }

        }
    }

}
