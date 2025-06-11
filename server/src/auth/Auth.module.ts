import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './Auth.service';
import { AuthController } from './Auth.controller';
import * as dotenv from 'dotenv';
import { UsersModule } from 'src/database/users/users.module';
import { PassportModule } from '@nestjs/passport';


dotenv.config();

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.SECRET_KEY,
      signOptions: { expiresIn: '3600s' },
    }),
    UsersModule,
  ],
  providers: [AuthService, JwtStrategy, 
    // RolesGuard, JwtAuthGuard, TokenRefreshInterceptor
  ],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}