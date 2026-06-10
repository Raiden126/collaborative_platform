import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { AuthUser, JwtPayload } from '../auth.types';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Return value becomes req.user. We resolve fresh roles/permissions so that
  // permission changes take effect on the next request (not just next login).
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findAuthUserById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }
}
