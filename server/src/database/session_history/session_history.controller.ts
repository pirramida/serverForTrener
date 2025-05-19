import { Controller, Get, Post, Body, Delete, Patch } from '@nestjs/common';
import { SessionService } from './session_history.service';

@Controller('session_history')
export class SessionController {
    constructor(private readonly sessionService: SessionService) { }


    @Get()
    async getWriteOffHistory() {
        return await this.sessionService.getWriteOffHistory();
    }
    // @Get()
    // async getPaymentHistory() {
    //     return await this.sessionService.getAllPaymentHistory();
    // }

    // @Post()
    // async postNewPaymentHistory(@Body() body: { fromData: any }) {
    //     try {
    //         const response = await this.sessionService.postNewPaymentHistory(body.fromData);
    //         return { message: 'Успешно!', data: response }
    //     } catch (error) {
    //         return { message: error };
    //     }
    // }

    // @Patch('/quantity')
    // async getQuantity(@Body() client: any) {
    //     return await this.sessionService.getQuantity(client);
    // }

    // @Patch()
    // async changeSessionsClient(@Body() body: { client: any, payload: any }) {
    //     try {
    //         const response = await this.sessionService.changeSessionsClient(body.client, body.payload);
    //         if (response) {
    //             return { status: true, data: response }
    //         }
    //         return { status: false }

    //     } catch (error) {
    //         return { message: error }

    //     }
    // }
 
}
