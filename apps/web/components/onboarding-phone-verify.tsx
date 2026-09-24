'use client';

import { useState } from 'react';
import { CheckCircle2, Phone } from 'lucide-react';
import type { WorkspaceRole } from '@surveylink/types';
import { OtpInput, type OtpStatus } from './otp-input';
import { OtpResendControls } from './otp-resend-controls';
import type { OtpResendGate } from '../lib/otp-resend-gate';
import {
  PhoneInput,
  defaultPhoneInput,
  phoneInputIsValid,
  phoneInputToE164,
  type PhoneInputValue,
} from './phone-input';

interface OnboardingPhoneVerifyProps {
  verified: boolean;
  phoneCode: string;
  onPhoneCodeChange: (code: string) => void;
  phoneInput: PhoneInputValue;
  onPhoneInputChange: (value: PhoneInputValue) => void;
  busy: string | null;
  otpStatus?: OtpStatus;
  onSendCode: (phone: string) => Promise<void>;
  onVerify: () => Promise<void>;
  onError?: (message: string) => void;
  compact?: boolean;
  resendGate?: OtpResendGate;
  role?: WorkspaceRole | null;
}

export function OnboardingPhoneVerify({
  verified,
  phoneCode,
  onPhoneCodeChange,
  phoneInput,
  onPhoneInputChange,
  busy,
  otpStatus = 'idle',
  onSendCode,
  onVerify,
  onError,
  compact = false,
  resendGate,
  role,
}: OnboardingPhoneVerifyProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [sendInfo, setSendInfo] = useState<string | null>(null);

  const locked = resendGate?.locked ?? false;
  const canVerify = resendGate?.canVerify ?? true;
  const canSend = resendGate?.canSend ?? true;

  async function handleSendCode() {
    if (!phoneInputIsValid(phoneInput)) {
      onError?.('Enter a valid mobile number for the selected country.');
      return;
    }
    if (resendGate && !resendGate.canSend) return;
    try {
      const e164 = phoneInputToE164(phoneInput);
      await onSendCode(e164);
      setOtpSent(true);
      setSendInfo(`Code sent to ${e164}`);
    } catch {
      /* parent sets error + gate from 429 */
    }
  }

  if (verified) {
    return (
      <div className="onboarding-channel is-verified">
        <Phone size={18} />
        <span className="onboarding-channel-copy">
          <strong>Mobile number</strong>
          <small>Verified</small>
        </span>
        <CheckCircle2 size={18} className="onboarding-channel-check" />
      </div>
    );
  }

  return (
    <div className={`onboarding-channel-block${compact ? ' is-compact' : ''}`}>
      <div className="onboarding-channel">
        <Phone size={18} />
        <span className="onboarding-channel-copy">
          <strong>Mobile number</strong>
          <small>
            {otpSent
              ? 'Enter the SMS code we sent to your phone'
              : 'Select your country, enter your number, then verify'}
          </small>
        </span>
      </div>

      <PhoneInput
        label="Mobile number"
        value={phoneInput}
        onChange={(next) => {
          onPhoneInputChange(next);
          setSendInfo(null);
        }}
        disabled={busy === 'phone-start' || busy === 'phone' || locked}
        required
      />

      {!otpSent ? (
        <>
          <button
            type="button"
            className="btn block"
            disabled={
              busy === 'phone-start' || !phoneInputIsValid(phoneInput) || !canSend || locked
            }
            onClick={() => void handleSendCode().catch(() => undefined)}
          >
            {busy === 'phone-start'
              ? 'Sending…'
              : locked
                ? 'Verification paused'
                : 'Send verification code'}
          </button>
          {resendGate ? (
            <OtpResendControls
              gate={resendGate}
              role={role}
              showButton={false}
              onResend={() => undefined}
            />
          ) : null}
        </>
      ) : (
        <div className="onboarding-otp-stack">
          {sendInfo ? <p className="onboarding-hint success">{sendInfo}</p> : null}
          <OtpInput
            value={phoneCode}
            onChange={onPhoneCodeChange}
            disabled={busy === 'phone' || !canVerify}
            status={otpStatus}
            autoFocus
            label="SMS verification code"
            onComplete={() => {
              if (busy === 'phone' || !canVerify) return;
              void onVerify();
            }}
          />
          <button
            type="button"
            className="btn block"
            disabled={
              busy === 'phone' ||
              !canVerify ||
              phoneCode.replace(/\D/g, '').length < 6
            }
            onClick={() => void onVerify()}
          >
            {busy === 'phone' ? 'Verifying…' : locked ? 'Verification paused' : 'Verify mobile number'}
          </button>
          {resendGate ? (
            <OtpResendControls
              gate={resendGate}
              role={role}
              busy={busy === 'phone-start'}
              onResend={() => void handleSendCode().catch(() => undefined)}
              resendLabel="Resend code"
            />
          ) : (
            <button
              type="button"
              className="btn secondary block"
              disabled={busy === 'phone-start'}
              onClick={() => void handleSendCode().catch(() => undefined)}
            >
              {busy === 'phone-start' ? 'Sending…' : 'Resend code'}
            </button>
          )}
          <button
            type="button"
            className="btn ghost block onboarding-change-phone"
            disabled={locked}
            onClick={() => {
              setOtpSent(false);
              setSendInfo(null);
              onPhoneCodeChange('');
              resendGate?.reset();
            }}
          >
            Change number
          </button>
        </div>
      )}
    </div>
  );
}

export { defaultPhoneInput, phoneInputIsValid, phoneInputToE164 };
export type { PhoneInputValue };
