import { Controller, Get, Post, Patch, Body, Query, HttpException, HttpStatus, UnauthorizedException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  jwtService: any;
  constructor(private readonly userService: UsersService) { }

  @Get()
  async getAllStatisticUser() {
    return await this.userService.getAllStatisticUser();
  }

  @Get('/customGet')
  async customGet(
    @Query('userId') userId: number,
    @Query('nameColoumn') nameColoumn?: string,
  ): Promise<any> {
    return this.userService.customGet(userId, nameColoumn);
  }

  @Patch('resetStatisticUser')
  async resetStatisticUser(@Body() user: any) {
    console.log('Получен пользователь:', user);
    return await this.userService.resetStatisticUser(user);
  }



  @Patch()
  async addGoogleAcc(@Body() body: any) {
    const { userdata, action } = body;
    return await this.userService.addGoogleAcc(userdata, action);
  }
  @UseGuards(JwtAuthGuard)
  @Get('googleEvents')
  async getGoogleCalendarEvents() {
    const events = await this.userService.getGoogleCalendarEvents();

    if (!events) {
      throw new HttpException(
        'Не удалось получить события',
        HttpStatus.BAD_REQUEST,
      );
    }

    return { message: true, events: events };
  }

  @Post('refresh')
  async exchangeCodeForTokens(@Body() body: any) {
    const code = body.code;
    const CLIENT_ID =
      '362002328679-n4uqn1arfofigtuur8po169gds8lrh76.apps.googleusercontent.com';
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
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (!data.refresh_token) {
      console.warn('⚠️ Не получен refresh_token:', data);
    }

    return data;
  }

  @Patch('newSessions')
  async addSessions(@Body() body: any) {
    const { newWorkout } = body;
    const response = await this.userService.addSessions(newWorkout);
    if (!response) {
      throw new HttpException(
        'Не удалось записать прошедшую тренировку',
        HttpStatus.BAD_REQUEST,
      );
    }
    return response;
  }

  // @Post('login')
  // async login(@Body() body: any) {
  //   const user = await this.userService.validateUser(body.username, body.password);
  //   if (!user) throw new UnauthorizedException();

  //   const payload = { sub: user.id, username: user.username };
  //   const token = this.jwtService.sign(payload);
  //   return { access_token: token };
  // }




  @Patch('dateUpdate')
  async changeDateUpdate(@Body() body: any) {
    const { dateUpdate, id } = body;
    const response = await this.userService.changeDateUpdate(dateUpdate, id);
    return response;
  }


}
