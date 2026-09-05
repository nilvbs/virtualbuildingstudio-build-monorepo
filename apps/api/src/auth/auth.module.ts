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
import { LocalPhoneVerifier } from './phone/local.phone-verifier';
import { EmailOtpService } from './email/email-otp.service';
import { EMAIL_SENDER } from '../notifications/delivery/email-sender';
import { TwilioEmailSender } from '../notifications/delivery/twilio.email-sender';
import { SMS_SENDER } from '../notifications/delivery/sms-sender';
import { TwilioSmsSender } from '../notifications/delivery/twilio.sms-sender';
import { AvatarStorageService } from './avatar-storage.service';
import { MediaModule } from '../media/media.module';

/**
 * Auth module — signup, email/phone OTP, onboarding, sessions via Auth0 +
 * Twilio SendGrid (email) + Twilio Messaging (SMS). Registers app-wide JWT /
 * role / permissions guards.
 */
@Module({
  imports: [PassportModule, MediaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    StaffContextService,
    SuperAdminBootstrapService,
    EmailOtpService,
    AvatarStorageService,
    { provide: IDENTITY_PROVIDER, useClass: Auth0IdentityProvider },
    { provide: EMAIL_SENDER, useClass: TwilioEmailSender },
    { provide: SMS_SENDER, useClass: TwilioSmsSender },
    { provide: PHONE_VERIFIER, useClass: LocalPhoneVerifier },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, StaffContextService, IDENTITY_PROVIDER],
})
export class AuthModule {}
