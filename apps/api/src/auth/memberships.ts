import type { MembershipRole, RoleHint, WorkspaceRole } from '@surveylink/types';
import type { PrismaService } from '../prisma/prisma.service';

type PrismaTx = Pick<PrismaService, 'userRole' | 'surveyorProfile' | 'adminProfile' | 'user'>;

export function hintFromMemberships(memberships: MembershipRole[]): RoleHint {
  const hasClient = memberships.includes('client');
  const hasSurveyor = memberships.includes('surveyor');
  if (hasClient && hasSurveyor) return 'both';
  if (hasSurveyor) return 'surveyor';
  if (hasClient) return 'client';
  // Admin-only accounts keep a neutral legacy hint (marketplace unused).
  return 'client';
}

export async function listMemberships(prisma: PrismaTx, userId: string): Promise<MembershipRole[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  return rows.map((r) => r.role as MembershipRole);
}

/** Provision a marketplace or staff role + its dedicated profile row. */
export async function ensureMembership(
  prisma: PrismaTx,
  userId: string,
  role: MembershipRole,
): Promise<void> {
  await prisma.userRole.upsert({
    where: { userId_role: { userId, role } },
    create: { userId, role },
    update: {},
  });

  if (role === 'surveyor') {
    await prisma.surveyorProfile.upsert({
      where: { userId },
      create: { userId, services: [], equipment: [], portfolio: [] },
      update: {},
    });
  }
  if (role === 'admin') {
    await prisma.adminProfile.upsert({
      where: { userId },
      create: {
        userId,
        staffLevel: 'admin',
        permissionPreset: 'matcher',
        permissions: [],
      },
      update: {},
    });
  }

  const memberships = await listMemberships(prisma, userId);
  await prisma.user.update({
    where: { id: userId },
    data: { roleHint: hintFromMemberships(memberships) },
  });
}

export async function requireWorkspaceMembership(
  prisma: PrismaTx,
  userId: string,
  role: WorkspaceRole,
): Promise<MembershipRole[]> {
  const memberships = await listMemberships(prisma, userId);
  if (!memberships.includes(role)) {
    return memberships;
  }
  return memberships;
}
