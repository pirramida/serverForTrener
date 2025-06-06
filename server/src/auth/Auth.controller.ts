import { Controller, Post, Body, Res, UseGuards, UseInterceptors, Req, UnauthorizedException  } from '@nestjs/common';
import { AuthService } from './Auth.service';
import { Request, Response } from 'express';
import { UsersService } from 'src/database/users/users.service';
import { JwtAuthGuard } from './Auth.guard';
import * as jwt from 'jsonwebtoken';
// import { TokenRefreshInterceptor } from './token-refresh.interceptor';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private usersService: UsersService) {}


  @Post('login')
async login(
  @Body() body: { username: string; password: string; hangar: string },
  @Res() res: Response,
  @Req() request: Request
) {
  const user = await this.usersService.validateUser(body.username, body.password);

  if (!user) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const { access_token, refresh_token } = await this.authService.login(user);

  res.cookie('accessToken', access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 15 * 60 * 1000, // 15 минут
  });

  res.cookie('refreshToken', refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 год
  });

  // usernames cookie логика — остаётся как есть
  const oldUserNames = request.cookies['usernames'];
  let userNames: string[] = [];
  if (oldUserNames) {
    try {
      userNames = JSON.parse(oldUserNames);
    } catch (e) {
      userNames = [];
    }
  }

  const userNamesMap = new Set(userNames);
  if (!userNamesMap.has(body.username)) {
    userNamesMap.add(body.username);
  }

  res.cookie('usernames', JSON.stringify([...userNamesMap]), {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.send({ message: 'Logged in successfully', user });
}


  @Post('refresh-token')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    // console.log('Received refresh token:', refreshToken);

    if (!refreshToken) {
      // console.log('Refresh token not found. Redirecting to login.');
      res.status(401).json({
        message: 'Refresh token not found. Redirecting to login.',
        redirect: true,
      });
      return;
    }

    try {
      const payload = jwt.verify(refreshToken, process.env.SECRET_KEY);
      // console.log('Payload from refresh token:', payload);

      //@ts-ignore
      const user = await this.authService.validateUserById(payload.sub);

      if (!user) {
        // console.log('User not found. Redirecting to login.');
        res.status(401).json({
          message: 'Invalid refresh token. Redirecting to login.',
          redirect: true,
        });
        return;
      }

      // console.log('User found. User:', user);
      const newAccessToken = (await this.authService.login(user)).access_token;
      // console.log('New access token:', newAccessToken);

      // Устанавливаем куки с правильным доменом
      res.cookie('accessToken', newAccessToken, {
        maxAge: 15 * 60 * 1000, 
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        // domain: '192.168.0.150', // укажите правильный домен uncomment for prod
        domain: 'localhost',
      });

      res.json({ accessToken: newAccessToken });
    } catch (error) {
      // console.log('Error occurred while refreshing token:', error.message);
      res.status(401).json({
        message: 'Invalid refresh token. Redirecting to login.',
        redirect: true,
      });
    }
  }

  @UseGuards(JwtAuthGuard)
  // @UseInterceptors(TokenRefreshInterceptor)
  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('token');
    return res.send({ message: 'Logged out successfully' });
  }
  
}