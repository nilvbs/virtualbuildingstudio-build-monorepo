import { SetMetadata } from '@nestjs/common';
import type { StaffPermission } from '@surveylink/types';

export const PERMISSIONS_KEY = 'permissions';

/** Requires the authenticated staff user to hold all listed permissions. */
export const RequirePermissions = (...permissions: StaffPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
