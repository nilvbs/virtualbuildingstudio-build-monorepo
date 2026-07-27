'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  ImagePlus,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  Users,
} from 'lucide-react';
import type { AccountType, OnboardingStatus, OnboardingStep, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { clearSession, getActiveRole, getSession, isAuthenticated } from '../../lib/session';
import { homePathForWorkspace } from '../../lib/home';
import { e164ToPhoneInput } from '../../lib/country-codes';
import {
  OnboardingPhoneVerify,
  defaultPhoneInput,
  type PhoneInputValue,
} from '../../components/onboarding-phone-verify';

const ONBOARDING_STEPS: { id: OnboardingStep; label: string }[] = [
  { id: 'select_account_type', label: 'Account type' },
  { id: 'accept_terms', label: 'Terms & NDA' },
  { id: 'verify_contact', label: 'Verify contact' },
  { id: 'complete_profile', label: 'Your details' },
  { id: 'portfolio', label: 'Portfolio' },
];

function stepIndex(step: OnboardingStep): number {
  if (step === 'done') return ONBOARDING_STEPS.length;
  const idx = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  return idx >= 0 ? idx : 0;
}

function nextHome(role: WorkspaceRole | undefined) {
  return homePathForWorkspace(role ?? 'client');
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [phoneInput, setPhoneInput] = useState<PhoneInputValue>(defaultPhoneInput());
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [workEmailCode, setWorkEmailCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptNda, setAcceptNda] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** UI step; may lag behind server when the user revisits an earlier step. */
  const [viewStep, setViewStep] = useState<OnboardingStep | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const role = getActiveRole();

  async function load() {
    const next = await api.getOnboarding();
    setStatus(next);
    setViewStep(next.step);
    setAccountType(next.accountType);
    setPhoneInput(
      !next.phoneVerified && next.phone && !next.phoneNeedsEntry
        ? e164ToPhoneInput(next.phone)
        : defaultPhoneInput(),
    );
    setFullName((current) => current || next.fullName);
    setCompanyName((current) => current || next.companyName || '');
    setWorkEmail((current) => current || next.workEmail || '');
    setRegistrationNumber((current) => current || next.registrationNumber || '');
    setWebsite((current) => current || next.website || '');
    setAddress((current) => ({
      line1: current.line1 || next.address.line1 || '',
      line2: current.line2 || next.address.line2 || '',
      city: current.city || next.address.city || '',
      state: current.state || next.address.state || '',
      postalCode: current.postalCode || next.address.postalCode || '',
      country: current.country || next.address.country || '',
    }));
    setAcceptTerms(next.termsAccepted);
    setAcceptNda(next.ndaAccepted);
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

  async function sendPhoneCode(phone: string) {
    setBusy('phone-start');
    setError(null);
    try {
      await api.startPhoneVerification(phone);
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setBusy(null);
    }
    await load();
  }

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

  async function signOut() {
    setBusy('sign-out');
    setError(null);
    try {
      const session = getSession();
      await api.logout(session?.refreshToken);
    } catch {
      /* best-effort revoke */
    }
    clearSession();
    window.location.assign('/?auth=login');
  }

  function visibleOnboardingSteps(requiresPortfolio: boolean) {
    return ONBOARDING_STEPS.filter((item) => requiresPortfolio || item.id !== 'portfolio');
  }

  function advanceReview() {
    if (!status) return;
    const display = viewStep ?? status.step;
    const visible = visibleOnboardingSteps(status.requiresPortfolio);
    const serverIdx = stepIndex(status.step);
    const idx = visible.findIndex((item) => item.id === display);
    const next = visible[idx + 1];
    if (next && stepIndex(next.id) <= serverIdx) {
      setViewStep(next.id);
      setError(null);
    }
  }

  function goBack() {
    if (!status) return;
    const display = viewStep ?? status.step;
    const visible = visibleOnboardingSteps(status.requiresPortfolio);
    const idx = visible.findIndex((item) => item.id === display);
    if (idx > 0) {
      setViewStep(visible[idx - 1]!.id);
      setError(null);
    }
  }

  function jumpToStep(step: OnboardingStep) {
    if (!status) return;
    if (stepIndex(step) > stepIndex(status.step)) return;
    setViewStep(step);
    setError(null);
  }

  async function submitAccountType(e: FormEvent) {
    e.preventDefault();
    if (status?.accountTypeSelected) {
      advanceReview();
      return;
    }
    await run('account-type', () => api.selectAccountType(accountType));
  }

  async function submitTerms(e: FormEvent) {
    e.preventDefault();
    if (status?.termsAccepted && status?.ndaAccepted) {
      advanceReview();
      return;
    }
    if (!acceptTerms || !acceptNda) {
      setError('You must accept both the Terms & Conditions and the NDA to continue.');
      return;
    }
    await run('terms', () => api.acceptTerms());
  }

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    const display = viewStep ?? status?.step;
    const reviewing =
      !!status && !!display && stepIndex(display) < stepIndex(status.step);
    if (reviewing) {
      advanceReview();
      return;
    }
    const isCompany = status?.accountType === 'company';
    if (isCompany && !status?.workEmailVerified) {
      setError('Verify your work email before continuing.');
      return;
    }
    await run('profile', () =>
      api.completeProfile({
        fullName,
        companyName: companyName.trim() ? companyName.trim() : null,
        address: {
          line1: address.line1.trim(),
          line2: address.line2.trim() ? address.line2.trim() : null,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          country: address.country.trim(),
        },
        registrationNumber: isCompany
          ? registrationNumber.trim() || null
          : undefined,
        website: isCompany ? (website.trim() ? website.trim() : null) : undefined,
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
      setStatus((current) => (current ? { ...current, avatarKey: next.avatarKey } : current));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <main className="ob">
        <div className="ob-loading">
          <span className="spin lg" />
          <p>Loading onboarding…</p>
        </div>
      </main>
    );
  }

  const visibleSteps = visibleOnboardingSteps(status.requiresPortfolio);
  const serverStepIndex = stepIndex(status.step);
  const displayStep = viewStep ?? status.step;
  const displayStepIndex = stepIndex(displayStep);
  const canGoBack = displayStepIndex > 0;
  const isReviewing = displayStepIndex < serverStepIndex;

  const needsAccountType = displayStep === 'select_account_type';
  const needsTerms = displayStep === 'accept_terms';
  const needsContact = displayStep === 'verify_contact';
  const needsProfile = displayStep === 'complete_profile';
  const needsPortfolio = displayStep === 'portfolio';
  const isCompany = status.accountType === 'company';
  const canAccept = acceptTerms && acceptNda;
  const accountTypeLocked = status.accountTypeSelected;

  const title = needsAccountType
    ? 'How will you use BLD?'
    : needsTerms
      ? 'Accept terms to continue'
      : needsContact
        ? 'Verify your contact'
        : needsProfile
          ? isCompany
            ? 'Company details'
            : 'Complete your profile'
          : 'Build your portfolio';

  const lede = needsAccountType
    ? 'Choose individual or company. This sets which details we ask for next.'
    : needsTerms
      ? 'Before onboarding, you must accept the Terms & Conditions and NDA. There is no skip.'
      : needsContact
        ? 'Verify your mobile number to continue. This step is required before your profile.'
        : needsProfile
          ? isCompany
            ? 'Verify your work email and add company address, registration number, and optional website.'
            : status.phoneVerified
              ? 'Your mobile is verified. Add your base address to finish setup.'
              : 'Verify your mobile and add your base address to finish setup.'
          : 'Add project examples next so clients can understand your work.';

  return (
    <main className="ob">
      <aside className="ob-aside" aria-hidden>
        <div className="ob-aside-inner">
          <Image
            src="/brand/bld-logo-light.png"
            alt="BLD"
            width={636}
            height={236}
            className="ob-aside-logo"
            priority
          />
          <p className="ob-aside-kicker">Account setup</p>
          <h2 className="ob-aside-title">Get your workspace ready</h2>
          <p className="ob-aside-copy">
            A few quick steps so we know who you are and how to match you on SurveyLink.
          </p>
          <ol className="ob-aside-steps">
            {visibleSteps.map((item, index) => {
              const done = index < serverStepIndex;
              const active = item.id === displayStep;
              const reachable = index <= serverStepIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`ob-aside-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}${reachable ? ' is-reachable' : ''}`}
                    disabled={!reachable}
                    onClick={() => jumpToStep(item.id)}
                  >
                    <span className="ob-aside-step-num">{done ? '✓' : index + 1}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="ob-aside-signout"
            disabled={busy === 'sign-out'}
            onClick={() => void signOut()}
          >
            <LogOut size={16} />
            {busy === 'sign-out' ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <section className="ob-main">
        <header className="ob-topbar">
          <div className="ob-topbar-row">
            <Image
              src="/brand/bld-logo-dark.png"
              alt="BLD"
              width={636}
              height={236}
              className="ob-topbar-logo"
              priority
            />
            <button
              type="button"
              className="ob-signout"
              disabled={busy === 'sign-out'}
              onClick={() => void signOut()}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
          <div className="ob-progress" aria-label="Onboarding progress">
            {visibleSteps.map((item, index) => {
              const done = index < serverStepIndex;
              const active = item.id === displayStep;
              const reachable = index <= serverStepIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ob-progress-seg${active ? ' is-active' : ''}${done ? ' is-done' : ''}${reachable ? ' is-reachable' : ''}`}
                  title={item.label}
                  disabled={!reachable}
                  onClick={() => jumpToStep(item.id)}
                >
                  <span className="ob-progress-bar" />
                  <span className="ob-progress-label">
                    {done ? '✓' : index + 1} {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="ob-scroll">
          <div className="ob-content">
            <div className="ob-head">
              {canGoBack ? (
                <button type="button" className="ob-back" onClick={goBack}>
                  <ArrowLeft size={16} />
                  Previous step
                </button>
              ) : null}
              <p className="ob-kicker">Account setup</p>
              <h1>{title}</h1>
              <p>{lede}</p>
            </div>

            {error && (
              <div className="alert error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

          {needsAccountType && (
            <form onSubmit={submitAccountType} className="onboarding-form">
              <div className="field">
                <span className="label">Continue as</span>
                <div className="onboarding-account-cards" role="group" aria-label="Account type">
                  <button
                    type="button"
                    className={`onboarding-account-card ${accountType === 'individual' ? 'is-active' : ''}`}
                    onClick={() => !accountTypeLocked && setAccountType('individual')}
                    disabled={accountTypeLocked}
                  >
                    <Users size={22} />
                    Individual
                  </button>
                  <button
                    type="button"
                    className={`onboarding-account-card ${accountType === 'company' ? 'is-active' : ''}`}
                    onClick={() => !accountTypeLocked && setAccountType('company')}
                    disabled={accountTypeLocked}
                  >
                    <Building2 size={22} />
                    Company
                  </button>
                </div>
                {accountTypeLocked ? (
                  <p className="hint">Account type is locked after selection.</p>
                ) : null}
              </div>
              <button className="btn block" disabled={busy === 'account-type'}>
                {busy === 'account-type' ? 'Saving…' : 'Continue'} <ArrowRight size={16} />
              </button>
            </form>
          )}

          {needsTerms && (
            <form onSubmit={submitTerms} className="onboarding-form">
              <label className="onboarding-accept">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  disabled={status.termsAccepted}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  <FileText size={16} />
                  <strong>I accept the Terms & Conditions</strong>
                  <small>
                    Required. Review the{' '}
                    <a href="/terms" target="_blank" rel="noreferrer">
                      Terms & Conditions
                    </a>
                    .
                  </small>
                </span>
              </label>
              <label className="onboarding-accept">
                <input
                  type="checkbox"
                  checked={acceptNda}
                  disabled={status.ndaAccepted}
                  onChange={(e) => setAcceptNda(e.target.checked)}
                />
                <span>
                  <Shield size={16} />
                  <strong>I accept the NDA</strong>
                  <small>
                    Required. Review the{' '}
                    <a href="/nda" target="_blank" rel="noreferrer">
                      Non-Disclosure Agreement
                    </a>
                    .
                  </small>
                </span>
              </label>
              <button
                className="btn block"
                disabled={(!canAccept && !isReviewing) || busy === 'terms'}
              >
                {busy === 'terms' ? 'Saving…' : 'Continue'} <ArrowRight size={16} />
              </button>
              {!canAccept && !isReviewing && (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                  Accept both to unlock the next step. You cannot bypass this.
                </p>
              )}
            </form>
          )}

          {needsContact && (
            <div className="onboarding-form">
              {!status.emailVerified && (
                <div className="onboarding-channel-block">
                  <div className="onboarding-channel">
                    <Mail size={18} />
                    <span className="onboarding-channel-copy">
                      <strong>Email</strong>
                      <small>Enter the OTP sent to your inbox</small>
                    </span>
                  </div>
                  <input
                    className="input onboarding-input"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="Email verification code"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="btn block"
                    disabled={busy === 'email'}
                    onClick={() => void run('email', () => api.verifyEmail(emailCode))}
                  >
                    {busy === 'email' ? 'Verifying…' : 'Verify email'}
                  </button>
                  <button
                    type="button"
                    className="btn secondary block"
                    disabled={busy === 'email-start'}
                    onClick={() => void run('email-start', () => api.startEmailVerification())}
                  >
                    {busy === 'email-start' ? 'Sending…' : 'Resend email code'}
                  </button>
                </div>
              )}

              {status.emailVerified && (
                <div className="onboarding-channel is-verified">
                  <Mail size={18} />
                  <span className="onboarding-channel-copy">
                    <strong>Email</strong>
                    <small>Verified</small>
                  </span>
                  <CheckCircle2 size={18} className="onboarding-channel-check" />
                </div>
              )}

              <OnboardingPhoneVerify
                verified={status.phoneVerified}
                phoneCode={phoneCode}
                onPhoneCodeChange={setPhoneCode}
                phoneInput={phoneInput}
                onPhoneInputChange={setPhoneInput}
                busy={busy}
                onError={setError}
                onSendCode={sendPhoneCode}
                onVerify={() => run('phone', () => api.verifyPhone(phoneCode))}
              />
              {isReviewing ? (
                <button type="button" className="btn block" onClick={advanceReview}>
                  Continue <ArrowRight size={16} />
                </button>
              ) : null}
            </div>
          )}

          {needsProfile && (
            <form onSubmit={submitProfile} className="onboarding-form ob-profile-form">
              <div className="ob-identity">
                <div className="ob-identity-photo">
                  <button
                    type="button"
                    className="ob-avatar-btn"
                    disabled={busy === 'photo'}
                    onClick={() => photoInputRef.current?.click()}
                    aria-label={status.avatarKey ? 'Change profile photo' : 'Upload profile photo'}
                  >
                    {status.avatarKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={status.avatarKey} alt="" />
                    ) : (
                      <span>{initials(fullName)}</span>
                    )}
                    <span className="ob-avatar-overlay">
                      <ImagePlus size={16} />
                    </span>
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadPhoto}
                    hidden
                  />
                  <small>{busy === 'photo' ? 'Uploading…' : 'Photo'}</small>
                </div>
                <div className="field ob-identity-name">
                  <label htmlFor="fullName">Full name</label>
                  <div className="input-icon is-disabled">
                    <User size={16} />
                    <input id="fullName" value={fullName} readOnly disabled tabIndex={-1} />
                  </div>
                  <span className="hint">From your account · not editable here</span>
                </div>
              </div>

              <div className="ob-profile-grid">
                <div className="ob-profile-col">
              {isCompany && (
                <>
                  <div className="field">
                    <label htmlFor="companyName">Company name</label>
                    <div className="input-icon">
                      <Building2 size={16} />
                      <input
                        id="companyName"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Legal company name"
                      />
                    </div>
                  </div>

                  <div className="onboarding-channel is-verified" style={{ cursor: 'default' }}>
                    <Mail size={18} />
                    <span className="onboarding-channel-copy">
                      <strong>Work email</strong>
                      <small>
                        {status.workEmailVerified
                          ? `Verified · ${status.workEmail}`
                          : 'Corporate email requiring OTP verification'}
                      </small>
                    </span>
                    {status.workEmailVerified && (
                      <CheckCircle2 size={18} className="onboarding-channel-check" />
                    )}
                  </div>
                  {!status.workEmailVerified && (
                    <div className="onboarding-otp-stack">
                      <input
                        className="input onboarding-input"
                        type="email"
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        placeholder="name@company.com"
                        required
                      />
                      <button
                        type="button"
                        className="btn secondary block"
                        disabled={busy === 'work-start' || !workEmail.trim()}
                        onClick={() =>
                          void run('work-start', () => api.startWorkEmailVerification(workEmail.trim()))
                        }
                      >
                        {busy === 'work-start' ? 'Sending…' : 'Send work email code'}
                      </button>
                      <input
                        className="input onboarding-input"
                        type="text"
                        value={workEmailCode}
                        onChange={(e) => setWorkEmailCode(e.target.value)}
                        placeholder="Work email OTP"
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        className="btn block"
                        disabled={busy === 'work' || !workEmailCode.trim()}
                        onClick={() => void run('work', () => api.verifyWorkEmail(workEmailCode))}
                      >
                        Verify work email
                      </button>
                    </div>
                  )}

                  <div className="ob-two-col">
                    <div className="field">
                      <label htmlFor="registrationNumber">Registration number</label>
                      <input
                        id="registrationNumber"
                        className="input onboarding-input"
                        type="text"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="website">Website (optional)</label>
                      <input
                        id="website"
                        className="input onboarding-input"
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://"
                      />
                    </div>
                  </div>
                </>
              )}

              {!isCompany && (
                <div className="ob-verify-inline">
                  {status.emailVerified ? (
                    <div className="onboarding-channel is-verified">
                      <Mail size={18} />
                      <span className="onboarding-channel-copy">
                        <strong>Email</strong>
                        <small>Verified</small>
                      </span>
                      <CheckCircle2 size={18} className="onboarding-channel-check" />
                    </div>
                  ) : (
                    <div className="onboarding-channel-block">
                      <div className="onboarding-channel">
                        <Mail size={18} />
                        <span className="onboarding-channel-copy">
                          <strong>Email</strong>
                          <small>Enter the OTP from your inbox</small>
                        </span>
                      </div>
                      <div className="ob-inline-actions">
                        <input
                          className="input onboarding-input"
                          type="text"
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value)}
                          placeholder="Email code"
                          inputMode="numeric"
                        />
                        <button
                          type="button"
                          className="btn"
                          disabled={busy === 'email'}
                          onClick={() => void run('email', () => api.verifyEmail(emailCode))}
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                  {status.phoneVerified ? (
                    <div className="onboarding-channel is-verified">
                      <Phone size={18} />
                      <span className="onboarding-channel-copy">
                        <strong>Mobile number</strong>
                        <small>Verified{status.phone ? ` · ${status.phone}` : ''}</small>
                      </span>
                      <CheckCircle2 size={18} className="onboarding-channel-check" />
                    </div>
                  ) : (
                    <OnboardingPhoneVerify
                      verified={false}
                      phoneCode={phoneCode}
                      onPhoneCodeChange={setPhoneCode}
                      phoneInput={phoneInput}
                      onPhoneInputChange={setPhoneInput}
                      busy={busy}
                      compact
                      onError={setError}
                      onSendCode={sendPhoneCode}
                      onVerify={() => run('phone', () => api.verifyPhone(phoneCode))}
                    />
                  )}
                </div>
              )}

                </div>

                <div className="ob-profile-col ob-address">
              <div className="field">
                <label htmlFor="line1">{isCompany ? 'Company address' : 'Base address'}</label>
                  <div className="input-icon">
                    <MapPin size={16} />
                    <input
                      id="line1"
                      type="text"
                      value={address.line1}
                      onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                      placeholder="Address line 1"
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="line2">Address line 2 (optional)</label>
                  <input
                    id="line2"
                    className="input onboarding-input"
                    type="text"
                    value={address.line2}
                    onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                  />
                </div>
                <div className="onboarding-address-grid">
                  <div className="field">
                    <label htmlFor="city">City</label>
                    <input
                      id="city"
                      className="input onboarding-input"
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="state">State / region</label>
                    <input
                      id="state"
                      className="input onboarding-input"
                      type="text"
                      value={address.state}
                      onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="postalCode">Postal code</label>
                    <input
                      id="postalCode"
                      className="input onboarding-input"
                      type="text"
                      value={address.postalCode}
                      onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="country">Country</label>
                    <input
                      id="country"
                      className="input onboarding-input"
                      type="text"
                      value={address.country}
                      onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                </div>
              </div>

              <div className="ob-form-footer">
                <button
                  className="btn block"
                  disabled={busy === 'profile' || (isCompany && !status.workEmailVerified)}
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {needsPortfolio && (
            <div className="onboarding-form">
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
      </section>
    </main>
  );
}
