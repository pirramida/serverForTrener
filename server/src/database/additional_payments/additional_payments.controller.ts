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
import { additionalPaymentsService } from './additional_payments.service';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('additional_payments')
@UseGuards(JwtAuthGuard)
export class additionalPaymentsController {
  jwtService: any;
  constructor(private readonly additionalPaymentsService: additionalPaymentsService) { }

  @Get('/customGet')
  async customGet(
    @Query('clientId') clientId: number,
    @Query('nameColoumn') nameColoumn?: string,
  ): Promise<any> {
    return this.additionalPaymentsService.customGet(clientId, nameColoumn);
  }



  @Post()
  async postNewAdditionalPayments(@Body() body: any) {
    const pesponse = this.additionalPaymentsService.postNewAdditionalPayments(body);
    return { message: 'Успешно сохранено', data: body };
  }
}
