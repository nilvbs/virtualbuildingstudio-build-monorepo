'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from './api';
import type { WorkspaceRole } from '@surveylink/types';

/** Matches API `otp-send-guard`: 1 initial + 3 resends, then 1h lockout. */
export const OTP_MAX_SENDS = 4;
export const OTP_MAX_RESENDS = 3;
export const OTP_COOLDOWN_SEC = 30;
export const OTP_LOCKOUT_MS = 60 * 60 * 1000;

export type OtpBlockedPayload = {
  code: 'OTP_COOLDOWN' | 'OTP_LOCKOUT';
  message: string;
  retryAfterSec: number;
  unlockAt?: string;
  sendsUsed: number;
  sendsRemaining: number;
};

export function parseOtpBlocked(err: unknown): OtpBlockedPayload | null {
  if (!(err instanceof ApiError) || err.status !== 429) return null;
  const body = err.body as Partial<OtpBlockedPayload> | undefined;
  if (!body || (body.code !== 'OTP_COOLDOWN' && body.code !== 'OTP_LOCKOUT')) return null;
  return {
    code: body.code,
    message: typeof body.message === 'string' ? body.message : 'Too many requests.',
    retryAfterSec: Math.max(1, Number(body.retryAfterSec) || OTP_COOLDOWN_SEC),
    unlockAt: typeof body.unlockAt === 'string' ? body.unlockAt : undefined,
    sendsUsed: Math.max(0, Number(body.sendsUsed) || 0),
    sendsRemaining: Math.max(0, Number(body.sendsRemaining) || 0),
  };
}

export function supportTicketHref(role?: WorkspaceRole | null): string {
  if (role === 'surveyor') return '/surveyor/help?new=1';
  return '/client/help?new=1';
}

export type OtpResendGate = {
  /** Successful sends in this UI session (synced upward from 429). */
  sendsUsed: number;
  resendsUsed: number;
  resendsRemaining: number;
  cooldownSec: number;
  locked: boolean;
  unlockAtMs: number | null;
  lockoutRemainingSec: number;
  /** True when the next successful send would be the final allowed resend. */
  isLastResend: boolean;
  canSend: boolean;
  canVerify: boolean;
  markSent: () => void;
  applyBlocked: (payload: OtpBlockedPayload) => void;
  reset: () => void;
};

/**
 * Client-side mirror of OTP send pacing. Server still enforces; this drives
 * the resend button timer, last-attempt copy, and lockout UI.
 */
export function useOtpResendGate(): OtpResendGate {
  const [sendsUsed, setSendsUsed] = useState(0);
  const [cooldownUntilMs, setCooldownUntilMs] = useState(0);
  const [unlockAtMs, setUnlockAtMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const needsTick =
      cooldownUntilMs > Date.now() || (unlockAtMs != null && unlockAtMs > Date.now());
    if (!needsTick) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [cooldownUntilMs, unlockAtMs]);

  const locked = unlockAtMs != null && unlockAtMs > now;
  const cooldownSec = locked
    ? 0
    : Math.max(0, Math.ceil((cooldownUntilMs - now) / 1000));
  const lockoutRemainingSec = locked
    ? Math.max(0, Math.ceil(((unlockAtMs ?? 0) - now) / 1000))
    : 0;

  const resendsUsed = Math.max(0, sendsUsed - 1);
  const resendsRemaining = Math.max(0, OTP_MAX_RESENDS - resendsUsed);
  const isLastResend = !locked && sendsUsed >= 1 && resendsRemaining === 1;
  const canSend = !locked && cooldownSec === 0 && sendsUsed < OTP_MAX_SENDS;
  const canVerify = !locked;

  const markSent = useCallback(() => {
    setSendsUsed((n) => {
      const next = n + 1;
      if (next >= OTP_MAX_SENDS) {
        setUnlockAtMs(Date.now() + OTP_LOCKOUT_MS);
        setCooldownUntilMs(0);
      } else {
        setCooldownUntilMs(Date.now() + OTP_COOLDOWN_SEC * 1000);
      }
      return next;
    });
    setNow(Date.now());
  }, []);

  const applyBlocked = useCallback((payload: OtpBlockedPayload) => {
    setSendsUsed(payload.sendsUsed);
    if (payload.code === 'OTP_LOCKOUT') {
      const until = payload.unlockAt
        ? Date.parse(payload.unlockAt)
        : Date.now() + payload.retryAfterSec * 1000;
      setUnlockAtMs(Number.isFinite(until) ? until : Date.now() + OTP_LOCKOUT_MS);
      setCooldownUntilMs(0);
    } else {
      setCooldownUntilMs(Date.now() + payload.retryAfterSec * 1000);
    }
    setNow(Date.now());
  }, []);

  const reset = useCallback(() => {
    setSendsUsed(0);
    setCooldownUntilMs(0);
    setUnlockAtMs(null);
    setNow(Date.now());
  }, []);

  return useMemo(
    () => ({
      sendsUsed,
      resendsUsed,
      resendsRemaining,
      cooldownSec,
      locked,
      unlockAtMs,
      lockoutRemainingSec,
      isLastResend,
      canSend,
      canVerify,
      markSent,
      applyBlocked,
      reset,
    }),
    [
      sendsUsed,
      resendsUsed,
      resendsRemaining,
      cooldownSec,
      locked,
      unlockAtMs,
      lockoutRemainingSec,
      isLastResend,
      canSend,
      canVerify,
      markSent,
      applyBlocked,
      reset,
    ],
  );
}

export function formatLockoutClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
