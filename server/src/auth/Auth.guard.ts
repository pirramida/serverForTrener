import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('User not found');
    }
    return user;
  }
}
