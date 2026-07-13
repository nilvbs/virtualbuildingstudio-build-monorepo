import { SetMetadata } from '@nestjs/common';
import type { AppRole } from '@surveylink/types';

export const ROLES_KEY = 'roles';

/** Requires the authenticated principal to hold all of the given roles. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
