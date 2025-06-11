import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './Auth.service';
import { UsersService } from 'src/database/users/users.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TokenRefreshMiddleware implements NestMiddleware {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies['accessToken'];
    const refreshToken = req.cookies['refreshToken'];

  

    if (req.path === '/auth/refresh-token' || req.path === '/auth/login') {
        return next(); // Пропустить проверки для эндпоинтов обновления токена и логина
      }

    if (!accessToken && !refreshToken) {
      return next(new UnauthorizedException('Access denied'));
    }

    try {
      jwt.verify(accessToken, process.env.SECRET_KEY);
      return next(); // Если access токен валиден, продолжаем
    } catch (err) {
      if (err.name !== 'TokenExpiredError') {
        return next(new UnauthorizedException('Invalid access token'));
      }

      if (!refreshToken) {
        return next(new UnauthorizedException('Refresh token not found'));
      }

      try {
        const payload = jwt.verify(refreshToken, process.env.SECRET_KEY);
        //@ts-ignore
        const user = await this.usersService.findUserById(payload.sub);

        if (!user || user.refreshToken !== refreshToken) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        // Генерация нового access токена
        const newAccessToken = (await this.authService.login(user)).access_token;

        // Установка нового access токена в куки
        res.cookie('accessToken', newAccessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 15 * 60 * 1000, // 15 минут
        });

        return next();
      } catch (error) {
        return next(new UnauthorizedException('Invalid refresh token'));
      }
    }
  }
}
