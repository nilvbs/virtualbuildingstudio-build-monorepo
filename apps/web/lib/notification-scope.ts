import type { Notification } from '@surveylink/types';

export type MarketplaceSection = 'client' | 'surveyor';

const CLIENT_KINDS = new Set([
  'match_found',
  'matching_started',
  'match_accepted',
]);

const SURVEYOR_KINDS = new Set([
  'match_proposed',
  'match_offer',
]);

function sectionHome(section: MarketplaceSection): string {
  return section === 'client' ? '/client' : '/surveyor';
}

/** Normalize absolute or relative notification links to a pathname (+ search). */
export function notificationPath(linkUrl: string | null | undefined): string | null {
  if (!linkUrl) return null;
  try {
    if (/^https?:\/\//i.test(linkUrl)) {
      const u = new URL(linkUrl);
      return `${u.pathname}${u.search}`;
    }
  } catch {
    return null;
  }
  return linkUrl.startsWith('/') ? linkUrl : `/${linkUrl}`;
}

export function notificationBelongsToWorkspace(
  n: Notification,
  section: MarketplaceSection,
): boolean {
  if (section === 'client') {
    if (CLIENT_KINDS.has(n.kind)) return true;
    if (SURVEYOR_KINDS.has(n.kind)) return false;
  } else {
    if (SURVEYOR_KINDS.has(n.kind)) return true;
    if (CLIENT_KINDS.has(n.kind)) return false;
  }

  const path = notificationPath(n.linkUrl);
  if (!path) return false;
  return section === 'client' ? path.startsWith('/client') : path.startsWith('/surveyor');
}

/**
 * Safe in-app target for the active workspace.
 * Never routes a client into /surveyor or a surveyor into /client.
 */
export function resolveWorkspaceNotificationLink(
  linkUrl: string | null | undefined,
  section: MarketplaceSection,
): string {
  const path = notificationPath(linkUrl);
  if (!path) return sectionHome(section);

  if (section === 'client') {
    return path.startsWith('/client') ? path : '/client';
  }
  return path.startsWith('/surveyor') ? path : '/surveyor/requests';
}
