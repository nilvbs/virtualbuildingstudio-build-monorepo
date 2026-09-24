'use client';

import Link from 'next/link';
import type { OtpResendGate } from '../lib/otp-resend-gate';
import { formatLockoutClock, supportTicketHref } from '../lib/otp-resend-gate';
import type { WorkspaceRole } from '@surveylink/types';

type Props = {
  gate: OtpResendGate;
  role?: WorkspaceRole | null;
  /** Primary send/resend action. */
  onResend: () => void;
  busy?: boolean;
  /** Extra disable (e.g. empty email field). */
  disabled?: boolean;
  /** When false, hide the button (e.g. first send lives elsewhere). */
  showButton?: boolean;
  /** Label when no code has been sent yet. */
  sendLabel?: string;
  resendLabel?: string;
  className?: string;
  /** Use compact secondary styling (profile / inline). */
  compact?: boolean;
};

/**
 * Resend control with 30s cooldown, last-attempt warning, 1h lockout copy,
 * and a support-ticket link.
 */
export function OtpResendControls({
  gate,
  role,
  onResend,
  busy = false,
  disabled = false,
  showButton = true,
  sendLabel = 'Send code',
  resendLabel = 'Resend code',
  className,
  compact = false,
}: Props) {
  const helpHref = supportTicketHref(role);
  const hasSent = gate.sendsUsed > 0;
  const btnLabel = busy
    ? 'Sending…'
    : gate.locked
      ? 'Verification paused'
      : gate.cooldownSec > 0
        ? `Resend in ${gate.cooldownSec}s`
        : hasSent
          ? resendLabel
          : sendLabel;

  return (
    <div className={`otp-resend${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
      {showButton ? (
        <button
          type="button"
          className={`btn ${hasSent || gate.locked ? 'secondary' : ''} ${compact ? 'sm' : 'block'}`}
          disabled={busy || disabled || !gate.canSend}
          onClick={onResend}
        >
          {btnLabel}
        </button>
      ) : null}

      {gate.locked ? (
        <div className="otp-resend-lockout" role="alert">
          <p>
            Too many codes requested. Verification is paused for{' '}
            <strong>{formatLockoutClock(gate.lockoutRemainingSec)}</strong>.
          </p>
          <p>
            Having trouble?{' '}
            <Link href={helpHref} className="otp-resend-support">
              Create a support ticket
            </Link>
            .
          </p>
        </div>
      ) : null}

      {!gate.locked && gate.isLastResend ? (
        <p className="otp-resend-warn" role="status">
          1 attempt left — kindly wait a few more seconds if you still haven’t received the
          code. Otherwise you’ll be locked for 1 hour.{' '}
          <Link href={helpHref} className="otp-resend-support">
            Open a support ticket
          </Link>{' '}
          if you’re stuck.
        </p>
      ) : null}
    </div>
  );
}
