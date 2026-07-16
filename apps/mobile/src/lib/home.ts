import type { AuthenticatedUser, MembershipRole, WorkspaceRole } from '@surveylink/types';
import { getActiveRole } from './session';

export type AppHome = 'client' | 'surveyor';

export function homeForWorkspace(role: WorkspaceRole): AppHome {
  return role === 'client' ? 'client' : 'surveyor';
}

export async function homeForUser(
  user: Pick<AuthenticatedUser, 'roles' | 'roleHint' | 'memberships'>,
): Promise<AppHome> {
  const memberships = user.memberships ?? [];
  const active = await getActiveRole();
  if (active && memberships.includes(active)) return homeForWorkspace(active);
  if (memberships.includes('client') && !memberships.includes('surveyor')) return 'client';
  if (memberships.includes('surveyor') && !memberships.includes('client')) return 'surveyor';
  if (memberships.includes('client')) return 'client';
  if (user.roleHint === 'client') return 'client';
  return 'surveyor';
}

export function hasMembership(
  user: Pick<AuthenticatedUser, 'memberships' | 'roleHint'>,
  role: MembershipRole,
): boolean {
  if ((user.memberships ?? []).includes(role)) return true;
  if (role === 'client') return user.roleHint === 'client' || user.roleHint === 'both';
  if (role === 'surveyor') return user.roleHint === 'surveyor' || user.roleHint === 'both';
  return false;
}
