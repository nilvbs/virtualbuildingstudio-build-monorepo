'use client';

import { useState } from 'react';
import { CheckCircle2, Phone } from 'lucide-react';
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
  onSendCode: (phone: string) => Promise<void>;
  onVerify: () => Promise<void>;
  onError?: (message: string) => void;
  compact?: boolean;
}

export function OnboardingPhoneVerify({
  verified,
  phoneCode,
  onPhoneCodeChange,
  phoneInput,
  onPhoneInputChange,
  busy,
  onSendCode,
  onVerify,
  onError,
  compact = false,
}: OnboardingPhoneVerifyProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [sendInfo, setSendInfo] = useState<string | null>(null);

  async function handleSendCode() {
    if (!phoneInputIsValid(phoneInput)) {
      onError?.('Enter a valid mobile number for the selected country.');
      return;
    }
    try {
      const e164 = phoneInputToE164(phoneInput);
      await onSendCode(e164);
      setOtpSent(true);
      setSendInfo(`Code sent to ${e164}`);
    } catch {
      /* parent sets error */
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
        disabled={busy === 'phone-start' || busy === 'phone'}
        required
      />

      {!otpSent ? (
        <button
          type="button"
          className="btn block"
          disabled={busy === 'phone-start' || !phoneInputIsValid(phoneInput)}
          onClick={() => void handleSendCode().catch(() => undefined)}
        >
          {busy === 'phone-start' ? 'Sending…' : 'Send verification code'}
        </button>
      ) : (
        <div className="onboarding-otp-stack">
          {sendInfo ? <p className="onboarding-hint success">{sendInfo}</p> : null}
          <input
            className="input onboarding-input"
            value={phoneCode}
            onChange={(e) => onPhoneCodeChange(e.target.value)}
            placeholder="SMS verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <button
            type="button"
            className="btn block"
            disabled={busy === 'phone' || !phoneCode.trim()}
            onClick={() => void onVerify()}
          >
            {busy === 'phone' ? 'Verifying…' : 'Verify mobile number'}
          </button>
          <button
            type="button"
            className="btn secondary block"
            disabled={busy === 'phone-start'}
            onClick={() => void handleSendCode().catch(() => undefined)}
          >
            {busy === 'phone-start' ? 'Sending…' : 'Resend code'}
          </button>
          <button
            type="button"
            className="btn ghost block onboarding-change-phone"
            onClick={() => {
              setOtpSent(false);
              setSendInfo(null);
              onPhoneCodeChange('');
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
