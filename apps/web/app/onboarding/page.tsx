'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, ImagePlus, Mail, Phone, User } from 'lucide-react';
import type { OnboardingStatus, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { getActiveRole, isAuthenticated } from '../../lib/session';
import { homePathForWorkspace } from '../../lib/home';

function nextHome(role: WorkspaceRole | undefined) {
  return homePathForWorkspace(role ?? 'client');
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const role = getActiveRole();

  async function load() {
    const next = await api.getOnboarding();
    setStatus(next);
    setFullName((current) => current || next.fullName);
    setCompanyName((current) => current || next.companyName || '');
    if (next.step === 'done') router.replace(nextHome(role));
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    load().catch((err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    await run('profile', () =>
      api.completeProfile({
        fullName,
        companyName: companyName.trim() ? companyName.trim() : null,
      }),
    );
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

    setBusy('photo');
    setError(null);
    try {
      const next = await api.uploadAvatar(file, file.name);
      setStatus((current) => current ? { ...current, avatarKey: next.avatarKey } : current);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-panel" style={{ textAlign: 'center' }}>
            <span className="spin lg" />
            <p style={{ color: 'var(--muted)', marginTop: 12 }}>Loading onboarding…</p>
          </div>
        </div>
      </main>
    );
  }

  const needsContact = status.step === 'verify_contact';
  const needsProfile = status.step === 'complete_profile';
  const needsPortfolio = status.step === 'portfolio';

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <Image
            src="/brand/bld-logo-dark.png"
            alt="BLD"
            width={636}
            height={236}
            className="brand-logo"
            priority
          />
        </div>

        <div className="auth-panel">
          <p className="kicker" style={{ marginBottom: 4 }}>
            Account setup
          </p>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>
            {needsContact
              ? 'Verify your contact'
              : needsProfile
                ? 'Complete your personal profile'
                : 'Build your portfolio'}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 22 }}>
            {needsContact
              ? 'Verify either your email or phone to continue. You can finish the other later.'
              : needsProfile
                ? 'Add your personal details before moving to the workspace.'
                : 'Add project examples next so clients can understand your work.'}
          </p>

          {error && (
            <div className="alert error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {needsContact && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div className="auth-choice" style={{ cursor: 'default' }}>
                <Mail size={18} />
                <span style={{ flex: 1 }}>
                  <strong>Email</strong>
                  <small>{status.emailVerified ? 'Verified' : 'Enter the OTP sent to your inbox'}</small>
                </span>
                {status.emailVerified && <CheckCircle2 size={18} />}
              </div>
              {!status.emailVerified && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run('email', () => api.verifyEmail(emailCode));
                  }}
                  style={{ display: 'grid', gap: 10 }}
                >
                  <input
                    className="input"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="Email OTP"
                    inputMode="numeric"
                  />
                  <button className="btn block" disabled={busy === 'email'}>
                    Verify email
                  </button>
                  <button
                    type="button"
                    className="btn secondary block"
                    disabled={busy === 'email-start'}
                    onClick={() => void run('email-start', () => api.startEmailVerification())}
                  >
                    Resend email code
                  </button>
                </form>
              )}

              <div className="auth-choice" style={{ cursor: 'default' }}>
                <Phone size={18} />
                <span style={{ flex: 1 }}>
                  <strong>Phone</strong>
                  <small>{status.phoneVerified ? 'Verified' : 'Enter the SMS OTP sent to your phone'}</small>
                </span>
                {status.phoneVerified && <CheckCircle2 size={18} />}
              </div>
              {!status.phoneVerified && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run('phone', () => api.verifyPhone(phoneCode));
                  }}
                  style={{ display: 'grid', gap: 10 }}
                >
                  <input
                    className="input"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    placeholder="Phone OTP"
                    inputMode="numeric"
                  />
                  <button className="btn block" disabled={busy === 'phone'}>
                    Verify phone
                  </button>
                  <button
                    type="button"
                    className="btn secondary block"
                    disabled={busy === 'phone-start'}
                    onClick={() => void run('phone-start', () => api.startPhoneVerification())}
                  >
                    Resend SMS code
                  </button>
                </form>
              )}
            </div>
          )}

          {needsProfile && (
            <form onSubmit={submitProfile} style={{ display: 'grid', gap: 14 }}>
              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <div className="input-icon">
                  <User size={16} />
                  <input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
              {role === 'client' && (
                <div className="field">
                  <label htmlFor="companyName">Company name</label>
                  <input
                    id="companyName"
                    className="input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              )}
              <div className="onboarding-photo">
                <div className="onboarding-photo-preview">
                  {status.avatarKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={status.avatarKey} alt="Profile preview" />
                  ) : (
                    initials(fullName)
                  )}
                </div>
                <div>
                  <strong>Profile photo</strong>
                  <small>Optional · JPG, PNG, or WebP · up to 5 MB</small>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadPhoto}
                    hidden
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy === 'photo'}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <ImagePlus size={16} />
                    {busy === 'photo' ? 'Uploading…' : status.avatarKey ? 'Change photo' : 'Upload photo'}
                  </button>
                </div>
              </div>
              <button className="btn block" disabled={busy === 'profile'}>
                Continue <ArrowRight size={16} />
              </button>
            </form>
          )}

          {needsPortfolio && (
            <div style={{ display: 'grid', gap: 12 }}>
              <button
                type="button"
                className="btn block"
                onClick={() => router.replace('/surveyor/profile?portfolio=1')}
              >
                Go to portfolio builder <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="btn secondary block"
                disabled={busy === 'portfolio'}
                onClick={() => void run('portfolio', () => api.completePortfolio())}
              >
                I’ll add portfolio later
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
