import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import type {
  AuthenticatedUser,
  AuthPrincipal,
  AuthSession,
  GoogleAuthResult,
} from '@surveylink/types';
import {
  completeRegistrationSchema,
  googleExchangeSchema,
  loginSchema,
  logoutSchema,
  signupSchema,
  verifyPhoneSchema,
  type CompleteRegistrationInput,
  type GoogleExchangeInput,
  type LoginInput,
  type LogoutInput,
  type SignupInput,
  type VerifyPhoneInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<AuthenticatedUser> {
    return this.auth.signup(body);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthSession> {
    return this.auth.login(body.email, body.password);
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

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@CurrentUser() principal: AuthPrincipal): Promise<AuthenticatedUser> {
    return this.auth.verifyEmail(principal);
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
