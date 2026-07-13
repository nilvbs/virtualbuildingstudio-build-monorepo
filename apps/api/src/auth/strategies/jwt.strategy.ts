import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { AppRole, AuthPrincipal } from '@surveylink/types';
import { APP_ROLES } from '@surveylink/types';

interface Auth0JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  [claim: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly rolesClaim: string;

  constructor(config: ConfigService) {
    // Fall back to an unusable issuer when unconfigured so the app still boots
    // (protected routes simply 401 until Auth0 env is provided).
    const domain = config.get<string>('AUTH0_DOMAIN') ?? 'unconfigured.invalid';
    const audience = config.get<string>('AUTH0_AUDIENCE') ?? 'unconfigured';
    const issuer = `https://${domain}/`;
    const rolesClaim = config.get<string>('AUTH0_ROLES_CLAIM') ?? 'https://surveylink.app/roles';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuer}.well-known/jwks.json`,
      }),
    });
    this.rolesClaim = rolesClaim;
  }

  validate(payload: Auth0JwtPayload): AuthPrincipal {
    const raw = payload[this.rolesClaim];
    const roles: AppRole[] = Array.isArray(raw)
      ? (raw.filter((r): r is AppRole => APP_ROLES.includes(r as AppRole)))
      : [];
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      roles,
    };
  }
}
