import type { AuthenticatedUser, MembershipRole, RoleHint, WorkspaceRole } from '@surveylink/types';
import { getActiveRole } from './session';

export function homePathForWorkspace(role: WorkspaceRole): string {
  return role === 'client' ? '/client' : '/surveyor';
}

export function homePathForRoleHint(role: RoleHint | WorkspaceRole): string {
  return role === 'client' ? '/client' : '/surveyor';
}

/** Prefer login-selected workspace; fall back to memberships / legacy hint. */
export function homePathForUser(
  user: Pick<AuthenticatedUser, 'roles' | 'roleHint' | 'memberships'>,
): string {
  if (user.roles.includes('admin') && !(user.memberships ?? []).some((m) => m === 'client' || m === 'surveyor')) {
    return '/build/admin/queue';
  }

  const active = getActiveRole();
  if (active && (user.memberships ?? []).includes(active)) {
    return homePathForWorkspace(active);
  }

  const memberships = user.memberships ?? [];
  if (memberships.includes('client') && !memberships.includes('surveyor')) return '/client';
  if (memberships.includes('surveyor') && !memberships.includes('client')) return '/surveyor';
  if (memberships.includes('client')) return '/client';

  if (user.roleHint === 'client') return '/client';
  return '/surveyor';
}

export function workspaceMemberships(user: Pick<AuthenticatedUser, 'memberships' | 'roleHint'>): WorkspaceRole[] {
  const fromDb = (user.memberships ?? []).filter(
    (m): m is WorkspaceRole => m === 'client' || m === 'surveyor',
  );
  if (fromDb.length) return fromDb;
  if (user.roleHint === 'both') return ['client', 'surveyor'];
  if (user.roleHint === 'surveyor') return ['surveyor'];
  return ['client'];
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
