import { Controller, Get, Post, Patch, Body, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get()
  async getAllStatisticUser() {
    return await this.userService.getAllStatisticUser();
  }

  @Patch()
  async addGoogleAcc(@Body() body: any) {
    const { userdata, action } = body;
    return await this.userService.addGoogleAcc(userdata, action);
  }

  @Get('googleEvents')
  async getGoogleCalendarEvents() {
    const events = await this.userService.getGoogleCalendarEvents();

    if (!events) {
      throw new HttpException('Не удалось получить события', HttpStatus.BAD_REQUEST);
    }

    return events;
  }

  @Post('refresh')
  async exchangeCodeForTokens(@Body() body: any) {
    const code = body.code;
    const CLIENT_ID = "362002328679-n4uqn1arfofigtuur8po169gds8lrh76.apps.googleusercontent.com";
    const CLIENT_SECRET = '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';
    const REDIRECT_URI = 'postmessage'; // используем "postmessage" при offline access
  
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  
    const data = await response.json();
  
    if (!data.refresh_token) {
      console.warn('⚠️ Не получен refresh_token:', data);
    }
  
    return data;
  }
  


  
}
