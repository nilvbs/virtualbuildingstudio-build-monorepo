import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { StaffContextService } from './staff-context.service';
import { SuperAdminBootstrapService } from './super-admin.bootstrap';
import { IDENTITY_PROVIDER } from './identity/identity-provider';
import { Auth0IdentityProvider } from './identity/auth0.identity-provider';
import { PHONE_VERIFIER } from './phone/phone-verifier';
import { TwilioPhoneVerifier } from './phone/twilio.phone-verifier';

/**
 * Auth module — signup, email verification, phone OTP, sessions, via a managed
 * provider (Auth0) with Twilio Verify for phone OTP. Registers the app-wide
 * JWT guard (auth on by default), role guard, and permissions guard.
 */
@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    StaffContextService,
    SuperAdminBootstrapService,
    { provide: IDENTITY_PROVIDER, useClass: Auth0IdentityProvider },
    { provide: PHONE_VERIFIER, useClass: TwilioPhoneVerifier },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, StaffContextService, IDENTITY_PROVIDER],
})
export class AuthModule {}
