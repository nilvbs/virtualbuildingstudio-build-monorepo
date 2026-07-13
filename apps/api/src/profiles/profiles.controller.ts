import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import type { AuthPrincipal, SurveyorProfile, SurveyorStatus } from '@surveylink/types';
import {
  createSurveyorProfileSchema,
  updateSurveyorProfileSchema,
  type CreateSurveyorProfileInput,
  type UpdateSurveyorProfileInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfilesService } from './profiles.service';

@Controller('surveyor')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post('profile')
  createProfile(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createSurveyorProfileSchema)) body: CreateSurveyorProfileInput,
  ): Promise<SurveyorProfile> {
    return this.profiles.createProfile(principal.sub, body);
  }

  @Get('profile')
  getProfile(@CurrentUser() principal: AuthPrincipal): Promise<SurveyorProfile> {
    return this.profiles.getProfile(principal.sub);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(updateSurveyorProfileSchema)) body: UpdateSurveyorProfileInput,
  ): Promise<SurveyorProfile> {
    return this.profiles.updateProfile(principal.sub, body);
  }

  @Get('status')
  getStatus(@CurrentUser() principal: AuthPrincipal): Promise<SurveyorStatus> {
    return this.profiles.getStatus(principal.sub);
  }
}
