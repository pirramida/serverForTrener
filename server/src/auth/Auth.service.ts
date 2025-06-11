import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/database/users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async validateUser(username: string, password: string,
  ): Promise<any> {
    const user = await this.usersService.validateUser(username, password
    );
    if (user) {
      return user;
    }
    return null;
  }

  async validateUserById(userId: number): Promise<any> {
    const user = await this.usersService.findUserById(userId);
    if (!user) {
      // console.log('а теперь здеся плохо')
      throw new UnauthorizedException('User not found');
    }
    // console.log('а теперь здеся хорошо')
    return user;
  }

  async login(user: any) {
    const { id, name, roles } = user.user ?? user;

    const access_token = this.jwtService.sign({ sub: id, roles }, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign({ sub: id }, { expiresIn: '7d' });

    // ✅ Сохраняем refresh токен в базе
    await this.usersService.storeRefreshToken(id, refresh_token);

    return {
      access_token,
      refresh_token,
    };
  }

}
