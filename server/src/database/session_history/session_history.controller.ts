import { Controller, Get, Post, Body, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { SessionService } from './session_history.service';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('session_history')
@UseGuards(JwtAuthGuard)
export class SessionController {
    jwtService: any;
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
