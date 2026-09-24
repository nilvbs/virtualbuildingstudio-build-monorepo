'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AtSign,
  BadgeCheck,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Phone,
  XCircle,
} from 'lucide-react';
import type { AccountType, AuthenticatedUser, OnboardingStatus, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { parseOtpBlocked, useOtpResendGate } from '../lib/otp-resend-gate';
import { AddressFields } from './address-fields';
import { OtpInput } from './otp-input';
import { OtpResendControls } from './otp-resend-controls';

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

type VerifyChannel = 'email' | 'phone';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

function VerificationBadge({ verified }: { verified: boolean }) {
  return (
    <span className={`personal-verify${verified ? ' is-verified' : ' is-pending'}`}>
      {verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {verified ? 'Verified' : 'Not verified'}
    </span>
  );
}

function nextPendingChannel(user: AuthenticatedUser): VerifyChannel | null {
  if (!user.emailVerified) return 'email';
  if (!user.phoneVerified) return 'phone';
  return null;
}

export function PersonalProfilePage({ role }: { role: WorkspaceRole }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [verifyChannel, setVerifyChannel] = useState<VerifyChannel | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [otpStatus, setOtpStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [verifySending, setVerifySending] = useState(false);
  const verifyingRef = useRef(false);
  const otpGate = useOtpResendGate();

  function applyOnboarding(onboarding: OnboardingStatus) {
    setAccountType(onboarding.accountType);
    setCompanyName(onboarding.companyName ?? '');
    setRegistrationNumber(onboarding.registrationNumber ?? '');
    setWebsite(onboarding.website ?? '');
    setAddress({
      line1: onboarding.address.line1 ?? '',
      line2: onboarding.address.line2 ?? '',
      city: onboarding.address.city ?? '',
      state: onboarding.address.state ?? '',
      postalCode: onboarding.address.postalCode ?? '',
      country: onboarding.address.country ?? '',
    });
  }

  useEffect(() => {
    Promise.all([api.me(), api.getOnboarding()])
      .then(([nextUser, onboarding]) => {
        setUser(nextUser);
        setFullName(nextUser.fullName);
        applyOnboarding(onboarding);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSavedMessage(null);
    setError(null);
    try {
      const isCompany = accountType === 'company';
      await api.updateMe({
        ...(role === 'client' || isCompany
          ? { companyName: companyName.trim() ? companyName.trim() : null }
          : {}),
        address: {
          line1: address.line1.trim(),
          line2: address.line2.trim() ? address.line2.trim() : null,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          country: address.country.trim(),
        },
        ...(isCompany
          ? {
              registrationNumber: registrationNumber.trim() || null,
              website: website.trim() || null,
            }
          : {}),
      });
      const onboarding = await api.getOnboarding();
      applyOnboarding(onboarding);
      setEditing(false);
      setSavedMessage('Personal details saved.');
      window.dispatchEvent(new Event('bld:user-updated'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    setSavedMessage(null);
    setError(null);
    setEditing(true);
  }

  async function sendCodeFor(channel: VerifyChannel) {
    if (!otpGate.canSend) return;
    setVerifySending(true);
    setError(null);
    setOtpCode('');
    try {
      if (channel === 'email') await api.startEmailVerification();
      else await api.startPhoneVerification();
      otpGate.markSent();
      setVerifyChannel(channel);
    } catch (err) {
      const blocked = parseOtpBlocked(err);
      if (blocked) {
        otpGate.applyBlocked(blocked);
        setError(blocked.message);
        if (blocked.code === 'OTP_LOCKOUT') setVerifyChannel(channel);
      } else {
        setError(errorMessage(err));
        setVerifyChannel(null);
      }
    } finally {
      setVerifySending(false);
    }
  }

  async function beginVerification() {
    if (!user || verifySending || verifyBusy) return;
    const channel = nextPendingChannel(user);
    if (!channel) return;
    setSavedMessage(null);
    otpGate.reset();
    await sendCodeFor(channel);
  }

  async function submitOtp(code: string) {
    if (!verifyChannel || verifyingRef.current) return;
    if (!otpGate.canVerify) {
      setError('Verification is paused. Try again after the lockout or open a support ticket.');
      return;
    }
    const cleaned = code.replace(/\D/g, '');
    if (cleaned.length < 6) return;
    verifyingRef.current = true;
    setVerifyBusy(true);
    setOtpStatus('checking');
    setError(null);
    try {
      const nextUser =
        verifyChannel === 'email'
          ? await api.verifyEmail(cleaned)
          : await api.verifyPhone(cleaned);
      setOtpStatus('success');
      await new Promise((r) => window.setTimeout(r, 700));
      setUser(nextUser);
      window.dispatchEvent(new Event('bld:user-updated'));
      setOtpCode('');
      setOtpStatus('idle');
      const next = nextPendingChannel(nextUser);
      if (next) {
        setSavedMessage(
          verifyChannel === 'email' ? 'Email verified. Sending a code to your phone…' : null,
        );
        otpGate.reset();
        await sendCodeFor(next);
      } else {
        setVerifyChannel(null);
        otpGate.reset();
        setSavedMessage('Contact verified.');
      }
    } catch (err) {
      const blocked = parseOtpBlocked(err);
      if (blocked) {
        otpGate.applyBlocked(blocked);
        setOtpStatus('idle');
        setError(blocked.message);
      } else {
        setOtpStatus('error');
        setError(errorMessage(err));
        setOtpCode('');
      }
    } finally {
      verifyingRef.current = false;
      setVerifyBusy(false);
    }
  }

  async function resendCode() {
    if (!verifyChannel || verifySending || verifyBusy || !otpGate.canSend) return;
    await sendCodeFor(verifyChannel);
  }

  async function cancelEditing() {
    setEditing(false);
    setError(null);
    try {
      const onboarding = await api.getOnboarding();
      if (user) setFullName(user.fullName);
      applyOnboarding(onboarding);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Profile photo must be a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be 5 MB or smaller.');
      return;
    }

    setUploadingPhoto(true);
    setSavedMessage(null);
    setError(null);
    try {
      const next = await api.uploadAvatar(file, file.name);
      setUser(next);
      setSavedMessage('Profile photo updated.');
      window.dispatchEvent(new Event('bld:user-updated'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (!user) {
    return <div className="personal-profile-card skeleton" style={{ minHeight: 280 }} />;
  }

  const avatarIsUrl = /^(https?:\/\/|\/)/.test(user.avatarKey ?? '');
  const isCompany = accountType === 'company';
  const showCompanyName = role === 'client' || isCompany;
  const fullyVerified = user.emailVerified && user.phoneVerified;
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'there';

  return (
    <div className="personal-profile">
      <header className="personal-profile-hello">
        <h1 className="personal-profile-hello-title">Hi {firstName}</h1>
        <p className="personal-profile-hello-copy">
          {fullyVerified
            ? 'Your account looks great — keep your photo and address up to date.'
            : 'Finish verifying email and phone so clients and matches can reach you reliably.'}
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {savedMessage && <div className="alert success">{savedMessage}</div>}

      <div className="personal-profile-grid">
        <section className="personal-profile-card personal-profile-identity">
          <div className="personal-avatar-wrap">
            <div className="personal-avatar">
              {avatarIsUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarKey!} alt={`${user.fullName}'s profile`} />
              ) : (
                initials(user.fullName)
              )}
            </div>
            <input
              ref={photoInputRef}
              className="personal-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadPhoto}
              tabIndex={-1}
            />
            <button
              type="button"
              className="personal-avatar-edit"
              aria-label="Upload profile photo"
              title="Upload profile photo"
              disabled={uploadingPhoto}
              onClick={() => photoInputRef.current?.click()}
            >
              {uploadingPhoto ? (
                <LoaderCircle size={14} className="spin" strokeWidth={2.5} />
              ) : (
                <Pencil size={14} strokeWidth={2.5} aria-hidden />
              )}
            </button>
          </div>
          <h2 className="personal-identity-name">
            <span>{user.fullName}</span>
            {fullyVerified ? (
              <BadgeCheck
                className="personal-identity-verified"
                size={20}
                aria-label="Email and mobile verified"
              />
            ) : null}
          </h2>
          <p className="personal-identity-meta">
            @{user.username}
            {' · '}
            {fullyVerified ? 'Verified account' : 'Verification incomplete'}
          </p>
        </section>

        <section className="personal-profile-card">
          <h2>Contact</h2>
          <div className="personal-contact-list">
            <div className="personal-contact-row">
              <span className="personal-contact-icon">
                <AtSign size={17} />
              </span>
              <span className="personal-contact-copy">
                <small>Email</small>
                <strong>{user.email}</strong>
              </span>
              <VerificationBadge verified={user.emailVerified} />
            </div>
            <div className="personal-contact-row">
              <span className="personal-contact-icon">
                <Phone size={17} />
              </span>
              <span className="personal-contact-copy">
                <small>Phone</small>
                <strong>{user.phone}</strong>
              </span>
              <VerificationBadge verified={user.phoneVerified} />
            </div>
          </div>
          {(!user.emailVerified || !user.phoneVerified) && (
            <div className="personal-verify-panel">
              {!verifyChannel ? (
                <button
                  type="button"
                  className="btn secondary personal-verify-cta"
                  disabled={verifySending || verifyBusy}
                  onClick={() => void beginVerification()}
                >
                  {verifySending ? (
                    <>
                      <LoaderCircle size={15} className="spin" aria-hidden />
                      Sending code…
                    </>
                  ) : (
                    'Complete verification'
                  )}
                </button>
              ) : (
                <>
                  <p className="personal-verify-hint">
                    {verifyChannel === 'email'
                      ? `Enter the 6-digit code sent to ${user.email}.`
                      : `Enter the 6-digit code sent to ${user.phone}.`}
                  </p>
                  <OtpInput
                    value={otpCode}
                    onChange={(code) => {
                      setOtpCode(code);
                      if (otpStatus === 'error') setOtpStatus('idle');
                    }}
                    disabled={verifyBusy || verifySending || !otpGate.canVerify}
                    status={otpStatus}
                    autoFocus
                    label={
                      verifyChannel === 'email'
                        ? 'Email verification code'
                        : 'Phone verification code'
                    }
                    onComplete={(code) => {
                      void submitOtp(code);
                    }}
                  />
                  <div className="personal-verify-actions">
                    <OtpResendControls
                      gate={otpGate}
                      role={role}
                      busy={verifySending}
                      compact
                      onResend={() => void resendCode()}
                      resendLabel="Resend code"
                    />
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={verifyBusy || verifySending}
                      onClick={() => {
                        setVerifyChannel(null);
                        setOtpCode('');
                        otpGate.reset();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <section className="personal-profile-card personal-profile-edit">
          <div className="personal-details-heading">
            <h2>Details</h2>
            {!editing && (
              <button type="button" className="personal-details-edit-button" onClick={startEditing}>
                <Pencil size={14} />
                Edit
              </button>
            )}
          </div>
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="personal-full-name">Full name</label>
              <input id="personal-full-name" value={fullName} disabled readOnly />
              <span className="hint">From your account · not editable here</span>
            </div>

            {showCompanyName && (
              <div className="field">
                <label htmlFor="personal-company">Company name</label>
                <input
                  id="personal-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!editing}
                  placeholder="Optional"
                />
              </div>
            )}

            {isCompany && (
              <>
                <div className="field">
                  <label htmlFor="personal-registration">Registration number</label>
                  <input
                    id="personal-registration"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    disabled={!editing}
                  />
                </div>
                <div className="field">
                  <label htmlFor="personal-website">Website</label>
                  <input
                    id="personal-website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={!editing}
                    placeholder="https://"
                  />
                </div>
              </>
            )}

            <AddressFields
              value={address}
              onChange={setAddress}
              variant="plain"
              line1Label={isCompany ? 'Company address' : 'Base address'}
              disabled={!editing}
              required={editing}
              idPrefix="personal"
            />

            {editing && (
              <div className="personal-details-actions">
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => void cancelEditing()}
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
