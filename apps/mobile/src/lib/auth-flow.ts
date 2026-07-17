import type { AuthenticatedUser, WorkspaceRole } from '@surveylink/types';
import { api } from './api';
import { homeForUser, homeForWorkspace } from './home';

export type PostAuthDestination =
  | { kind: 'onboarding' }
  | { kind: 'home'; home: 'client' | 'surveyor' };

/** Route marketplace users through onboarding until `onboardingStep === 'done'`. */
export async function destinationAfterAuth(
  role: WorkspaceRole,
  user?: AuthenticatedUser | null,
): Promise<PostAuthDestination> {
  const me = user ?? (await api.me());
  if (me.onboardingStep && me.onboardingStep !== 'done') {
    return { kind: 'onboarding' };
  }
  const home = user ? await homeForUser(me) : homeForWorkspace(role);
  return { kind: 'home', home };
}
