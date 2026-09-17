import type { SignupAccountNotice } from '@surveylink/types';

const ACCOUNT_NOTICE_KEY = 'bld.accountNotice';

/** Persist a one-time signup notice for the next screen (onboarding or shell). */
export function stashAccountNotice(notice: SignupAccountNotice): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ACCOUNT_NOTICE_KEY, JSON.stringify(notice));
  } catch {
    // ignore quota / private mode
  }
}

/** Read and clear a stashed signup notice (if any). */
export function takeAccountNotice(): SignupAccountNotice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACCOUNT_NOTICE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(ACCOUNT_NOTICE_KEY);
    return JSON.parse(raw) as SignupAccountNotice;
  } catch {
    return null;
  }
}
