import type { Notification } from '@surveylink/types';

export type WorkspaceSection = 'client' | 'surveyor' | 'admin';

/** @deprecated Use WorkspaceSection */
export type MarketplaceSection = WorkspaceSection;

const CLIENT_KINDS = new Set([
  'match_found',
  'matching_started',
  'match_accepted',
  'feedback_submitted',
  'helpdesk_ticket_created',
  'helpdesk_reply',
]);

const SURVEYOR_KINDS = new Set([
  'match_proposed',
  'match_offer',
  'feedback_submitted',
  'helpdesk_ticket_created',
  'helpdesk_reply',
]);

/** In-app kinds created for staff (see NotificationsService). */
const ADMIN_KINDS = new Set([
  'feedback_received',
  'helpdesk_ticket_received',
  'helpdesk_reply',
  'project_posted',
  'surveyor_joined',
]);

function sectionHome(section: WorkspaceSection): string {
  if (section === 'client') return '/client';
  if (section === 'surveyor') return '/surveyor';
  return '/build/admin/queue';
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
  section: WorkspaceSection,
): boolean {
  const path = notificationPath(n.linkUrl);

  if (section === 'admin') {
    if (ADMIN_KINDS.has(n.kind)) {
      // Shared kind `helpdesk_reply` is also used for marketplace users —
      // only show staff-targeted ones (admin deep links).
      if (n.kind === 'helpdesk_reply') {
        return Boolean(path?.startsWith('/build/admin'));
      }
      return true;
    }
    return Boolean(path?.startsWith('/build/admin'));
  }

  if (section === 'client') {
    if (CLIENT_KINDS.has(n.kind)) {
      // Dual-role users share one account — scope shared kinds by link path.
      if (
        n.kind === 'helpdesk_reply' ||
        n.kind === 'helpdesk_ticket_created' ||
        n.kind === 'feedback_submitted'
      ) {
        return Boolean(path?.startsWith('/client'));
      }
      return true;
    }
    if (SURVEYOR_KINDS.has(n.kind) || ADMIN_KINDS.has(n.kind)) return false;
  } else {
    if (SURVEYOR_KINDS.has(n.kind)) {
      if (
        n.kind === 'helpdesk_reply' ||
        n.kind === 'helpdesk_ticket_created' ||
        n.kind === 'feedback_submitted'
      ) {
        return Boolean(path?.startsWith('/surveyor'));
      }
      return true;
    }
    if (CLIENT_KINDS.has(n.kind) || ADMIN_KINDS.has(n.kind)) return false;
  }

  if (!path) return false;
  return section === 'client' ? path.startsWith('/client') : path.startsWith('/surveyor');
}

/**
 * Safe in-app target for the active workspace.
 * Never routes a client into /surveyor, a surveyor into /client, or either into admin.
 */
export function resolveWorkspaceNotificationLink(
  linkUrl: string | null | undefined,
  section: WorkspaceSection,
): string {
  const path = notificationPath(linkUrl);
  if (!path) return sectionHome(section);

  if (section === 'admin') {
    return path.startsWith('/build/admin') ? path : '/build/admin/queue';
  }
  if (section === 'client') {
    return path.startsWith('/client') ? path : '/client';
  }
  return path.startsWith('/surveyor') ? path : '/surveyor/requests';
}
