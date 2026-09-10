import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, BadRequestException } from '@nestjs/common';
import type { AuthPrincipal, HelpTicket, HelpTicketDetail, HelpTicketWorkspace } from '@surveylink/types';
import {
  createHelpTicketSchema,
  helpTicketMessageSchema,
  helpTicketWorkspaceSchema,
  updateHelpTicketSchema,
  type CreateHelpTicketInput,
  type HelpTicketMessageInput,
  type UpdateHelpTicketInput,
} from '@surveylink/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { HelpdeskService } from './helpdesk.service';

function parseWorkspace(raw: string | undefined): HelpTicketWorkspace {
  const parsed = helpTicketWorkspaceSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestException('workspace query must be client or surveyor');
  }
  return parsed.data;
}

@Controller()
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Post('helpdesk/tickets')
  create(
    @CurrentUser() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createHelpTicketSchema)) body: CreateHelpTicketInput,
  ): Promise<HelpTicketDetail> {
    return this.helpdesk.create(principal.sub, body);
  }

  @Get('helpdesk/tickets')
  listMine(
    @CurrentUser() principal: AuthPrincipal,
    @Query('workspace') workspaceRaw?: string,
  ): Promise<HelpTicket[]> {
    return this.helpdesk.listMine(principal.sub, parseWorkspace(workspaceRaw));
  }

  @Get('helpdesk/tickets/:id')
  getMine(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('workspace') workspaceRaw?: string,
  ): Promise<HelpTicketDetail> {
    return this.helpdesk.getMine(principal.sub, id, parseWorkspace(workspaceRaw));
  }

  @Post('helpdesk/tickets/:id/messages')
  replyMine(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(helpTicketMessageSchema)) body: HelpTicketMessageInput,
    @Query('workspace') workspaceRaw?: string,
  ): Promise<HelpTicketDetail> {
    return this.helpdesk.replyMine(principal.sub, id, body, parseWorkspace(workspaceRaw));
  }

  @Get('admin/helpdesk/tickets')
  @Roles('admin')
  @RequirePermissions('projects:view')
  listAdmin(): Promise<HelpTicket[]> {
    return this.helpdesk.listAdmin();
  }

  @Get('admin/helpdesk/tickets/:id')
  @Roles('admin')
  @RequirePermissions('projects:view')
  getAdmin(@Param('id', ParseUUIDPipe) id: string): Promise<HelpTicketDetail> {
    return this.helpdesk.getAdmin(id);
  }

  @Patch('admin/helpdesk/tickets/:id')
  @Roles('admin')
  @RequirePermissions('projects:view')
  updateAdmin(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateHelpTicketSchema)) body: UpdateHelpTicketInput,
  ): Promise<HelpTicketDetail> {
    return this.helpdesk.updateAdmin(principal.sub, id, body);
  }

  @Post('admin/helpdesk/tickets/:id/messages')
  @Roles('admin')
  @RequirePermissions('projects:view')
  replyAdmin(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(helpTicketMessageSchema)) body: HelpTicketMessageInput,
  ): Promise<HelpTicketDetail> {
    return this.helpdesk.replyAdmin(principal.sub, id, body);
  }
}
