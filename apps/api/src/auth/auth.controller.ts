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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type {
  AuthenticatedUser,
  AuthPrincipal,
  AuthSession,
  GoogleAuthResult,
  GoogleStartResult,
  OnboardingStatus,
  SignupResult,
} from '@surveylink/types';
import {
  acceptTermsSchema,
  completeProfileSchema,
  completeRegistrationSchema,
  forgotPasswordSchema,
  googleExchangeSchema,
  loginSchema,
  logoutSchema,
  refreshSessionSchema,
  addMembershipSchema,
  resetPasswordSchema,
  selectAccountTypeSchema,
  signupSchema,
  startPhoneVerificationSchema,
  startWorkEmailSchema,
  updateMeSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  verifyWorkEmailSchema,
  type AddMembershipInput,
  type CompleteProfileInput,
  type CompleteRegistrationInput,
  type ForgotPasswordInput,
  type GoogleExchangeInput,
  type LoginInput,
  type LogoutInput,
  type RefreshSessionInput,
  type ResetPasswordInput,
  type SelectAccountTypeInput,
  type SignupInput,
  type StartPhoneVerificationInput,
  type StartWorkEmailInput,
  type UpdateMeInput,
  type VerifyEmailInput,
  type VerifyPhoneInput,
  type VerifyWorkEmailInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionService } from './session/session.service';
import { OAUTH_NONCE_COOKIE, isCookieTransport, readCookie } from './session/session-cookies';

const PER_MINUTE = 60_000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: PER_MINUTE } })
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupResult> {
    const result = await this.auth.signup(body);
    return { ...result, session: await this.sessions.issue(result.session, req, res) };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: PER_MINUTE } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.login(body.email, body.password, body.role);
    return this.sessions.issue(session, req, res);
  }

  /** Rotate the refresh token (httpOnly cookie on web, body on mobile). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: PER_MINUTE } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSessionSchema)) body: RefreshSessionInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.sessions.refresh(req, res, body?.refreshToken);
  }

  /** Marketplace only — requires client|surveyor role; staff portal has no forgot-password. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: PER_MINUTE } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
  ): Promise<{ ok: true; message: string }> {
    return this.auth.forgotPassword(body.email, body.role);
  }

  /** Validate a reset token and return a masked email for the set-password screen. */
  @Public()
  @Get('reset-password')
  peekResetPassword(@Query('token') token?: string) {
    return this.auth.peekPasswordResetToken(token ?? '');
  }

  /** Consume the one-time reset token and set a new password for that user only. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: PER_MINUTE } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<{ ok: true }> {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: PER_MINUTE } })
  @Get('oauth/google/start')
  googleStart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('role') role?: string,
    @Query('redirectUri') redirectUri?: string,
  ): GoogleStartResult {
    const { url, nonce } = this.auth.startGoogleLogin(role, redirectUri);
    if (isCookieTransport(req)) {
      this.sessions.setOAuthNonceCookie(res, nonce);
      return { url };
    }
    return { url, nonce };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: PER_MINUTE } })
  @Post('oauth/google/exchange')
  @HttpCode(HttpStatus.OK)
  async googleExchange(
    @Body(new ZodValidationPipe(googleExchangeSchema)) body: GoogleExchangeInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleAuthResult> {
    const cookieMode = isCookieTransport(req);
    const nonce = cookieMode ? readCookie(req, OAUTH_NONCE_COOKIE) : body.nonce;
    if (cookieMode) this.sessions.clearOAuthNonceCookie(res);
    const result = await this.auth.exchangeGoogle(body.code, body.state, body.redirectUri, nonce);
    return {
      ...result,
      session: await this.sessions.issue(result.session, req, res, { email: result.profile.email }),
    };
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

  /** Public so an expired access token can still revoke the refresh family and clear cookies. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.logout(req, res, body?.refreshToken);
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
  uploadAvatar(
    @CurrentUser() principal: AuthPrincipal,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AuthenticatedUser> {
    return this.auth.replaceAvatar(principal, file);
  }

  @Get('onboarding')
  onboarding(@CurrentUser() principal: AuthPrincipal): Promise<OnboardingStatus> {
    return this.auth.getOnboarding(principal);
  }

  @Post('onboarding/account-type')
  @HttpCode(HttpStatus.OK)
  selectAccountType(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(selectAccountTypeSchema)) body: SelectAccountTypeInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.selectAccountType(principal, body.accountType);
  }

  @Post('onboarding/accept-terms')
  @HttpCode(HttpStatus.OK)
  acceptTerms(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(acceptTermsSchema)) _body: unknown,
  ): Promise<AuthenticatedUser> {
    void _body;
    return this.auth.acceptTerms(principal);
  }

  @Post('onboarding/work-email/start')
  @HttpCode(HttpStatus.OK)
  startWorkEmail(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(startWorkEmailSchema)) body: StartWorkEmailInput,
  ): Promise<{ ok: true }> {
    return this.auth.startWorkEmailVerification(principal, body.workEmail);
  }

  @Post('onboarding/work-email/verify')
  @HttpCode(HttpStatus.OK)
  verifyWorkEmail(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(verifyWorkEmailSchema)) body: VerifyWorkEmailInput,
  ): Promise<AuthenticatedUser> {
    return this.auth.verifyWorkEmail(principal, body.code);
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
  startPhoneVerification(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(startPhoneVerificationSchema)) body: StartPhoneVerificationInput,
  ): Promise<{ ok: true }> {
    return this.auth.startPhoneVerification(principal, body.phone);
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
