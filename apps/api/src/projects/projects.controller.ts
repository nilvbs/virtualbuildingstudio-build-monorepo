import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthPrincipal, ClientSurveyorPage, Project, ProjectDetail } from '@surveylink/types';
import {
  clientSurveyorBrowseSchema,
  createProjectSchema,
  type ClientSurveyorBrowseInput,
  type CreateProjectInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ): Promise<Project> {
    return this.projects.create(principal.sub, body);
  }

  @Get()
  list(@CurrentUser() principal: AuthPrincipal): Promise<Project[]> {
    return this.projects.listForClient(principal.sub);
  }

  @Get(':id/surveyors')
  browseSurveyors(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(clientSurveyorBrowseSchema)) query: ClientSurveyorBrowseInput,
  ): Promise<ClientSurveyorPage> {
    return this.projects.browseSurveyors(principal.sub, id, query);
  }

  @Get(':id')
  getOne(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDetail> {
    return this.projects.getById(principal.sub, principal.roles, id);
  }
}
