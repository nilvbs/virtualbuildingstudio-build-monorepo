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
import { EmailOtpService } from './email/email-otp.service';
import { EMAIL_SENDER } from '../notifications/delivery/email-sender';
import { SendgridEmailSender } from '../notifications/delivery/sendgrid.email-sender';
import { AvatarStorageService } from './avatar-storage.service';

/**
 * Auth module — signup, email/phone OTP, onboarding, sessions via Auth0 + Twilio
 * Verify + local email OTP. Registers app-wide JWT / role / permissions guards.
 */
@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    StaffContextService,
    SuperAdminBootstrapService,
    EmailOtpService,
    AvatarStorageService,
    { provide: IDENTITY_PROVIDER, useClass: Auth0IdentityProvider },
    { provide: PHONE_VERIFIER, useClass: TwilioPhoneVerifier },
    { provide: EMAIL_SENDER, useClass: SendgridEmailSender },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, StaffContextService, IDENTITY_PROVIDER],
})
export class AuthModule {}
