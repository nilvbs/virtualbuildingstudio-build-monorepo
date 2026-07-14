import { Injectable } from '@nestjs/common';
import type {
  StaffLevel,
  StaffPermission,
  StaffPermissionPreset,
} from '@surveylink/types';
import { resolveStaffPermissions } from '@surveylink/types';
import { PrismaService } from '../prisma/prisma.service';

export interface StaffContext {
  userId: string;
  staffLevel: StaffLevel;
  permissionPreset: StaffPermissionPreset;
  permissions: StaffPermission[];
}

@Injectable()
export class StaffContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getBySubject(subject: string): Promise<StaffContext | null> {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: subject },
      select: {
        id: true,
        roles: { where: { role: 'admin' }, select: { role: true } },
        adminProfile: {
          select: {
            staffLevel: true,
            permissionPreset: true,
            permissions: true,
          },
        },
      },
    });
    if (!user || user.roles.length === 0 || !user.adminProfile) return null;

    const staffLevel = (user.adminProfile.staffLevel as StaffLevel) || 'admin';
    const permissionPreset =
      (user.adminProfile.permissionPreset as StaffPermissionPreset) || 'matcher';
    const stored = Array.isArray(user.adminProfile.permissions)
      ? (user.adminProfile.permissions as StaffPermission[])
      : [];

    return {
      userId: user.id,
      staffLevel,
      permissionPreset,
      permissions: resolveStaffPermissions({
        staffLevel,
        permissionPreset,
        permissions: stored,
      }),
    };
  }

  hasPermission(ctx: StaffContext, required: StaffPermission[]): boolean {
    if (ctx.staffLevel === 'super_admin') return true;
    return required.every((p) => ctx.permissions.includes(p));
  }
}
