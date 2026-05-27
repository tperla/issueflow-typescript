import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'issueflow-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: { sub: number; username: string }) {
    const token = req.headers?.authorization?.split(' ')[1];
    if (token && this.authService.isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token has been invalidated');
    }
    return { id: payload.sub, username: payload.username };
  }
}
