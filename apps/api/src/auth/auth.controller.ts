import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type {
  AuthenticatedUser,
  AuthPrincipal,
  AuthSession,
  GoogleAuthResult,
  OnboardingStatus,
  SignupResult,
} from '@surveylink/types';
import {
  completeProfileSchema,
  completeRegistrationSchema,
  forgotPasswordSchema,
  googleExchangeSchema,
  loginSchema,
  logoutSchema,
  addMembershipSchema,
  signupSchema,
  updateMeSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  type AddMembershipInput,
  type CompleteProfileInput,
  type CompleteRegistrationInput,
  type ForgotPasswordInput,
  type GoogleExchangeInput,
  type LoginInput,
  type LogoutInput,
  type SignupInput,
  type UpdateMeInput,
  type VerifyEmailInput,
  type VerifyPhoneInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AvatarStorageService } from './avatar-storage.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  @Public()
  @Post('signup')
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<SignupResult> {
    return this.auth.signup(body);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthSession> {
    return this.auth.login(body.email, body.password, body.role);
  }

  /** Marketplace only — requires client|surveyor role; staff portal has no forgot-password. */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
  ): Promise<{ ok: true; message: string }> {
    return this.auth.forgotPassword(body.email, body.role);
  }

  @Public()
  @Get('oauth/google/start')
  googleStart(@Query('role') role?: string): { url: string } {
    return this.auth.startGoogleLogin(role);
  }

  @Public()
  @Post('oauth/google/exchange')
  @HttpCode(HttpStatus.OK)
  googleExchange(
    @Body(new ZodValidationPipe(googleExchangeSchema)) body: GoogleExchangeInput,
  ): Promise<GoogleAuthResult> {
    return this.auth.exchangeGoogle(body.code, body.state);
  }

  @Post('complete-registration')
  @HttpCode(HttpStatus.OK)
  completeRegistration(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(completeRegistrationSchema)) body: CompleteRegistrationInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.completeRegistration(principal, body);
  }

  @Post('memberships')
  @HttpCode(HttpStatus.OK)
  addMembership(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(addMembershipSchema)) body: AddMembershipInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.addMembership(principal, body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutInput,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() principal: AuthPrincipal): Promise<AuthenticatedUser> {
    return this.auth.me(principal);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.updateMe(principal, body);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @CurrentUser() principal: AuthPrincipal,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ): Promise<AuthenticatedUser> {
    const configuredBaseUrl = process.env.API_PUBLIC_URL?.trim();
    const requestBaseUrl = `${request.protocol}://${request.get('host')}`;
    const avatarKey = await this.avatarStorage.save(
      principal.sub,
      file,
      configuredBaseUrl || requestBaseUrl,
    );
    return this.auth.updateMe(principal, { avatarKey });
  }

  @Get('onboarding')
  onboarding(@CurrentUser() principal: AuthPrincipal): Promise<OnboardingStatus> {
    return this.auth.getOnboarding(principal);
  }

  @Post('onboarding/complete-profile')
  @HttpCode(HttpStatus.OK)
  completeProfile(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(completeProfileSchema)) body: CompleteProfileInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.completeProfile(principal, body);
  }

  @Post('onboarding/complete-portfolio')
  @HttpCode(HttpStatus.OK)
  completePortfolio(@CurrentUser() principal: AuthPrincipal): Promise<AuthenticatedUser> {
    return this.auth.completePortfolio(principal);
  }

  @Post('verify-email/start')
  @HttpCode(HttpStatus.OK)
  startEmailVerification(@CurrentUser() principal: AuthPrincipal): Promise<{ ok: true }> {
    return this.auth.startEmailVerification(principal);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.verifyEmail(principal, body.code);
  }

  @Post('verify-phone/start')
  @HttpCode(HttpStatus.OK)
  startPhoneVerification(@CurrentUser() principal: AuthPrincipal): Promise<{ ok: true }> {
    return this.auth.startPhoneVerification(principal);
  }

  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  verifyPhone(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(verifyPhoneSchema)) body: VerifyPhoneInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.verifyPhone(principal, body.code);
  }
}
