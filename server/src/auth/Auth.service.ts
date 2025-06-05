import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/database/users/users.service'; 

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string, 
    // machineId: string,
    hangar: string
  ): Promise<any> {
    const user = await this.usersService.loginUser(username, password, 
      // machineId,
      hangar
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
    return {
      access_token: this.jwtService.sign({ sub: id, roles }, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign({ sub: id }, { expiresIn: '7d' }),
    };
  }
}
