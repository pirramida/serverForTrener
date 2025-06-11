import { Controller, Get, Post, Body, Delete, Patch, Query } from '@nestjs/common';
import { SessionService } from './session_history.service';

@Controller('session_history')
export class SessionController {
    constructor(private readonly sessionService: SessionService) { }


    @Get()
    async getWriteOffHistory() {
        return await this.sessionService.getWriteOffHistory();
    }
    
    
    @Get('customGet')
    async customGetPaymentHistory(@Query('clientId') clientId: string) {
        return await this.sessionService.customGetPaymentHistory(+clientId);
    }
 
}
