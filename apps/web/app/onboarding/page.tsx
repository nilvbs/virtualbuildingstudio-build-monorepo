'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import type { AccountType, OnboardingStatus, OnboardingStep, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { toastError } from '../../lib/action-toast';
import { clearSession, getActiveRole, getSession, isAuthenticated } from '../../lib/session';
import { homePathForWorkspace } from '../../lib/home';
import { e164ToPhoneInput } from '../../lib/country-codes';
import { parseOtpBlocked, useOtpResendGate } from '../../lib/otp-resend-gate';
import { LordIcon } from '../../components/lord-icon';
import { OtpInput } from '../../components/otp-input';
import { OtpResendControls } from '../../components/otp-resend-controls';
import {
  OnboardingPhoneVerify,
  defaultPhoneInput,
  type PhoneInputValue,
} from '../../components/onboarding-phone-verify';
import { AddressFields } from '../../components/address-fields';
import { AccountNoticeBanner } from '../../components/account-notice-banner';

const ONBOARDING_STEPS: {
  id: OnboardingStep;
  label: string;
  hint: string;
  icon: 'account' | 'document' | 'mail' | 'avatar' | 'briefcase';
}[] = [
  {
    id: 'select_account_type',
    label: 'Account type',
    hint: 'Individual or company',
    icon: 'account',
  },
  {
    id: 'accept_terms',
    label: 'Terms & NDA',
    hint: 'Required agreements',
    icon: 'document',
  },
  {
    id: 'verify_contact',
    label: 'Verify contact',
    hint: 'Email and mobile',
    icon: 'mail',
  },
  {
    id: 'complete_profile',
    label: 'Your details',
    hint: 'Profile basics',
    icon: 'avatar',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    hint: 'Services and kit',
    icon: 'briefcase',
  },
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

function firstName(name: string | null | undefined) {
  const part = name?.trim().split(/\s+/)[0];
  return part || null;
}

const LORD_ON_PURPLE = 'primary:#ffffff,secondary:#c8c3ff';
const LORD_ON_LIGHT = 'primary:#5b52e0,secondary:#9b94ff';

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
  const [emailCodeSent, setEmailCodeSent] = useState(false);
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
  const [otpUi, setOtpUi] = useState<{
    email: 'idle' | 'checking' | 'success' | 'error';
    phone: 'idle' | 'checking' | 'success' | 'error';
    work: 'idle' | 'checking' | 'success' | 'error';
  }>({ email: 'idle', phone: 'idle', work: 'idle' });
  /** UI step; may lag behind server when the user revisits an earlier step. */
  const [viewStep, setViewStep] = useState<OnboardingStep | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const role = getActiveRole();
  const reduceMotion = useReducedMotion();
  const emailGate = useOtpResendGate();
  const phoneGate = useOtpResendGate();
  const workGate = useOtpResendGate();

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
    load().catch((err) => toastError('Couldn’t load onboarding', errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function sendPhoneCode(phone: string) {
    setBusy('phone-start');
    try {
      await api.startPhoneVerification(phone);
      phoneGate.markSent();
    } catch (err) {
      const blocked = parseOtpBlocked(err);
      if (blocked) {
        phoneGate.applyBlocked(blocked);
        toastError(blocked.message);
      } else {
        toastError(errorMessage(err));
      }
      throw err;
    } finally {
      setBusy(null);
    }
    await load();
  }

  async function sendEmailCode() {
    setBusy('email-start');
    try {
      await api.startEmailVerification();
      emailGate.markSent();
      setEmailCodeSent(true);
    } catch (err) {
      const blocked = parseOtpBlocked(err);
      if (blocked) {
        emailGate.applyBlocked(blocked);
        toastError(blocked.message);
      } else {
        toastError(errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  async function sendWorkEmailCode() {
    setBusy('work-start');
    try {
      await api.startWorkEmailVerification(workEmail.trim());
      workGate.markSent();
    } catch (err) {
      const blocked = parseOtpBlocked(err);
      if (blocked) {
        workGate.applyBlocked(blocked);
        toastError(blocked.message);
      } else {
        toastError(errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    try {
      await action();
      await load();
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  /** Verify OTP with checking → success border animation before refreshing status. */
  async function runVerify(
    label: 'email' | 'phone' | 'work',
    action: () => Promise<unknown>,
  ) {
    const gate = label === 'email' ? emailGate : label === 'phone' ? phoneGate : workGate;
    if (!gate.canVerify) {
      toastError('Verification is paused. Try again after the lockout or open a support ticket.');
      return;
    }
    setBusy(label);
    setOtpUi((prev) => ({ ...prev, [label]: 'checking' }));
    try {
      await action();
      setOtpUi((prev) => ({ ...prev, [label]: 'success' }));
      await new Promise((r) => window.setTimeout(r, 780));
      await load();
      setOtpUi((prev) => ({ ...prev, [label]: 'idle' }));
      gate.reset();
    } catch (err) {
      const blocked = parseOtpBlocked(err);
      if (blocked) {
        gate.applyBlocked(blocked);
        setOtpUi((prev) => ({ ...prev, [label]: 'idle' }));
        toastError(blocked.message);
      } else {
        setOtpUi((prev) => ({ ...prev, [label]: 'error' }));
        toastError(errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy('sign-out');
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
      }
  }

  /** Leave Verify contact once both channels are verified. */
  function continueFromContact() {
    if (!status?.canCompleteProfile) return;
    setViewStep('complete_profile');
  }

  function goBack() {
    if (!status) return;
    const display = viewStep ?? status.step;
    const visible = visibleOnboardingSteps(status.requiresPortfolio);
    const idx = visible.findIndex((item) => item.id === display);
    if (idx > 0) {
      setViewStep(visible[idx - 1]!.id);
      }
  }

  function jumpToStep(step: OnboardingStep) {
    if (!status) return;
    if (stepIndex(step) > stepIndex(status.step)) return;
    setViewStep(step);
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
      toastError('Accept required agreements', 'You must accept both the Terms & Conditions and the NDA to continue.');
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
      toastError('Work email required', 'Verify your work email before continuing.');
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
      toastError('Invalid photo', 'Profile photo must be a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toastError('Photo too large', 'Profile photo must be 5 MB or smaller.');
      return;
    }

    setBusy('photo');
    try {
      const next = await api.uploadAvatar(file, file.name);
      setStatus((current) => (current ? { ...current, avatarKey: next.avatarKey } : current));
    } catch (err) {
      toastError(errorMessage(err));
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
        ? 'Verify your email and mobile. Both are required before your profile.'
        : needsProfile
          ? isCompany
            ? 'Verify your work email and add company address, registration number, and optional website.'
            : status.phoneVerified && status.emailVerified
              ? 'Your contact details are verified. Add your base address to finish setup.'
              : 'Verify your email and mobile, then add your base address to finish setup.'
          : 'Add project examples next so clients can understand your work.';

  const welcomeName =
    firstName(fullName) || firstName(status.fullName) || firstName(status.companyName);
  const welcomeKicker = welcomeName ? `Hi, ${welcomeName}` : 'Welcome to BLD';

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
          <p className="ob-aside-kicker">{welcomeKicker}</p>
          <h2 className="ob-aside-title">Let&apos;s get you set up</h2>
          <p className="ob-aside-copy">
            {welcomeName
              ? `${welcomeName}, a few quick steps and your workspace will be ready to match on BLD.`
              : 'A few quick steps so we know who you are and how to match you on BLD.'}
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
                    <span className="ob-aside-step-icon" aria-hidden>
                      {done ? (
                        <LordIcon
                          name="check"
                          size={22}
                          trigger="in"
                          colors={active ? LORD_ON_LIGHT : LORD_ON_PURPLE}
                        />
                      ) : (
                        <LordIcon
                          name={item.icon}
                          size={22}
                          trigger={active ? 'loop' : 'hover'}
                          colors={active ? LORD_ON_LIGHT : LORD_ON_PURPLE}
                        />
                      )}
                    </span>
                    <span className="ob-aside-step-copy">
                      <span className="ob-aside-step-label">{item.label}</span>
                      <span className="ob-aside-step-hint">{item.hint}</span>
                    </span>
                    <span className="ob-aside-step-num">{index + 1}</span>
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
                    <LordIcon
                      name={done ? 'check' : item.icon}
                      size={14}
                      trigger={active ? 'loop' : 'hover'}
                      colors={active || done ? LORD_ON_LIGHT : 'primary:#6b668c,secondary:#9b94ff'}
                    />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="ob-scroll">
          <div className="ob-content">
            <AccountNoticeBanner />

            <div className="ob-head">
              {canGoBack ? (
                <button type="button" className="ob-back" onClick={goBack}>
                  <ArrowLeft size={16} />
                  Previous step
                </button>
              ) : null}
              <p className="ob-kicker">{welcomeKicker}</p>
              <h1>{title}</h1>
              <p>{lede}</p>
            </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={displayStep}
              className="ob-step-stage"
              initial={reduceMotion ? false : { opacity: 0, y: 16, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
            >

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
                    <span className="onboarding-account-card-icon" aria-hidden>
                      <LordIcon
                        name="avatar"
                        size={36}
                        trigger={accountType === 'individual' && !reduceMotion ? 'loop' : 'hover'}
                        colors={LORD_ON_LIGHT}
                      />
                    </span>
                    <strong>Individual</strong>
                    <small>Personal workspace</small>
                  </button>
                  <button
                    type="button"
                    className={`onboarding-account-card ${accountType === 'company' ? 'is-active' : ''}`}
                    onClick={() => !accountTypeLocked && setAccountType('company')}
                    disabled={accountTypeLocked}
                  >
                    <span className="onboarding-account-card-icon" aria-hidden>
                      <LordIcon
                        name="home"
                        size={36}
                        trigger={accountType === 'company' && !reduceMotion ? 'loop' : 'hover'}
                        colors={LORD_ON_LIGHT}
                      />
                    </span>
                    <strong>Company</strong>
                    <small>Team or business</small>
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
                  <LordIcon name="document" size={18} trigger="hover" />
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
                  <LordIcon name="security" size={18} trigger="hover" />
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
              <p className="ob-contact-req" style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--muted, #6B668C)' }}>
                Email and mobile verification are both required to continue.
                {status.pendingContact !== 'none' ? (
                  <>
                    {' '}
                    Still needed:{' '}
                    <strong>
                      {status.pendingContact === 'both'
                        ? 'email and phone'
                        : status.pendingContact === 'email'
                          ? 'email'
                          : 'phone'}
                    </strong>
                    .
                  </>
                ) : null}
              </p>
              {!status.emailVerified && (
                <div className="onboarding-channel-block">
                  <div className="onboarding-channel">
                    <LordIcon name="mail" size={20} trigger="in" />
                    <span className="onboarding-channel-copy">
                      <strong>Email</strong>
                      <small>
                        {emailCodeSent
                          ? 'Enter the OTP sent to your inbox'
                          : 'Request a code, then enter it below'}
                      </small>
                    </span>
                  </div>
                  {emailCodeSent ? (
                    <div className="onboarding-otp-stack">
                      <OtpInput
                        value={emailCode}
                        onChange={(code) => {
                          setEmailCode(code);
                          if (otpUi.email === 'error') {
                            setOtpUi((prev) => ({ ...prev, email: 'idle' }));
                          }
                        }}
                        disabled={busy === 'email' || !emailGate.canVerify}
                        status={otpUi.email}
                        autoFocus
                        label="Email verification code"
                        onComplete={(code) => {
                          if (busy === 'email' || !emailGate.canVerify) return;
                          void runVerify('email', () => api.verifyEmail(code));
                        }}
                      />
                      <button
                        type="button"
                        className="btn block"
                        disabled={
                          busy === 'email' ||
                          !emailGate.canVerify ||
                          emailCode.replace(/\D/g, '').length < 6
                        }
                        onClick={() => void runVerify('email', () => api.verifyEmail(emailCode))}
                      >
                        {busy === 'email'
                          ? 'Verifying…'
                          : emailGate.locked
                            ? 'Verification paused'
                            : 'Verify email'}
                      </button>
                      <OtpResendControls
                        gate={emailGate}
                        role={role}
                        busy={busy === 'email-start'}
                        onResend={() => void sendEmailCode()}
                        resendLabel="Resend email code"
                      />
                    </div>
                  ) : (
                    <OtpResendControls
                      gate={emailGate}
                      role={role}
                      busy={busy === 'email-start'}
                      onResend={() => void sendEmailCode()}
                      sendLabel="Send email code"
                      resendLabel="Resend email code"
                    />
                  )}
                </div>
              )}

              {status.emailVerified && (
                <div className="onboarding-channel is-verified">
                  <LordIcon name="mail" size={20} trigger="in" />
                  <span className="onboarding-channel-copy">
                    <strong>Email</strong>
                    <small>Verified</small>
                  </span>
                  <LordIcon name="check" size={20} trigger="in" />
                </div>
              )}

              <OnboardingPhoneVerify
                verified={status.phoneVerified}
                phoneCode={phoneCode}
                onPhoneCodeChange={(code) => {
                  setPhoneCode(code);
                  if (otpUi.phone === 'error') {
                    setOtpUi((prev) => ({ ...prev, phone: 'idle' }));
                  }
                }}
                phoneInput={phoneInput}
                onPhoneInputChange={setPhoneInput}
                busy={busy}
                otpStatus={otpUi.phone}
                onError={(msg) => toastError(msg)}
                onSendCode={sendPhoneCode}
                onVerify={() => runVerify('phone', () => api.verifyPhone(phoneCode))}
                resendGate={phoneGate}
                role={role}
              />
              {status.canCompleteProfile ? (
                <button type="button" className="btn block" onClick={continueFromContact}>
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
                      <LordIcon name="document" size={18} trigger="hover" />
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
                    <LordIcon name="avatar" size={18} trigger="hover" />
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
                      <LordIcon name="home" size={18} trigger="hover" />
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
                    <LordIcon name="mail" size={20} trigger="in" />
                    <span className="onboarding-channel-copy">
                      <strong>Work email</strong>
                      <small>
                        {status.workEmailVerified
                          ? `Verified · ${status.workEmail}`
                          : 'Corporate email requiring OTP verification'}
                      </small>
                    </span>
                    {status.workEmailVerified && (
                      <LordIcon name="check" size={20} trigger="in" />
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
                        disabled={workGate.locked}
                      />
                      <OtpResendControls
                        gate={workGate}
                        role={role}
                        busy={busy === 'work-start'}
                        disabled={!workEmail.trim()}
                        onResend={() => void sendWorkEmailCode()}
                        sendLabel="Send work email code"
                        resendLabel="Resend work email code"
                      />
                      <OtpInput
                        value={workEmailCode}
                        onChange={(code) => {
                          setWorkEmailCode(code);
                          if (otpUi.work === 'error') {
                            setOtpUi((prev) => ({ ...prev, work: 'idle' }));
                          }
                        }}
                        disabled={busy === 'work' || !workGate.canVerify}
                        status={otpUi.work}
                        autoFocus={false}
                        label="Work email verification code"
                        onComplete={(code) => {
                          if (busy === 'work' || !workGate.canVerify) return;
                          void runVerify('work', () => api.verifyWorkEmail(code));
                        }}
                      />
                      <button
                        type="button"
                        className="btn block"
                        disabled={
                          busy === 'work' ||
                          !workGate.canVerify ||
                          workEmailCode.replace(/\D/g, '').length < 6
                        }
                        onClick={() => void runVerify('work', () => api.verifyWorkEmail(workEmailCode))}
                      >
                        {busy === 'work'
                          ? 'Verifying…'
                          : workGate.locked
                            ? 'Verification paused'
                            : 'Verify work email'}
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
                      <LordIcon name="mail" size={20} trigger="in" />
                      <span className="onboarding-channel-copy">
                        <strong>Email</strong>
                        <small>Verified</small>
                      </span>
                      <LordIcon name="check" size={20} trigger="in" />
                    </div>
                  ) : (
                    <div className="onboarding-channel-block">
                      <div className="onboarding-channel">
                        <LordIcon name="mail" size={20} trigger="in" />
                        <span className="onboarding-channel-copy">
                          <strong>Email</strong>
                          <small>Enter the OTP from your inbox</small>
                        </span>
                      </div>
                      <div className="onboarding-otp-stack">
                        <OtpInput
                          value={emailCode}
                          onChange={(code) => {
                            setEmailCode(code);
                            if (otpUi.email === 'error') {
                              setOtpUi((prev) => ({ ...prev, email: 'idle' }));
                            }
                          }}
                          disabled={busy === 'email' || !emailGate.canVerify}
                          status={otpUi.email}
                          autoFocus={false}
                          label="Email verification code"
                          onComplete={(code) => {
                            if (busy === 'email' || !emailGate.canVerify) return;
                            void runVerify('email', () => api.verifyEmail(code));
                          }}
                        />
                        <div className="ob-inline-actions">
                          <button
                            type="button"
                            className="btn"
                            disabled={
                              busy === 'email' ||
                              !emailGate.canVerify ||
                              emailCode.replace(/\D/g, '').length < 6
                            }
                            onClick={() => void runVerify('email', () => api.verifyEmail(emailCode))}
                          >
                            {busy === 'email' ? 'Verifying…' : 'Verify'}
                          </button>
                          <OtpResendControls
                            gate={emailGate}
                            role={role}
                            busy={busy === 'email-start'}
                            compact
                            onResend={() => void sendEmailCode()}
                            sendLabel="Send code"
                            resendLabel="Resend"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {status.phoneVerified ? (
                    <div className="onboarding-channel is-verified">
                      <LordIcon name="bell" size={20} trigger="in" />
                      <span className="onboarding-channel-copy">
                        <strong>Mobile number</strong>
                        <small>Verified{status.phone ? ` · ${status.phone}` : ''}</small>
                      </span>
                      <LordIcon name="check" size={20} trigger="in" />
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
                      onError={(msg) => toastError(msg)}
                      onSendCode={sendPhoneCode}
                      onVerify={() => runVerify('phone', () => api.verifyPhone(phoneCode))}
                      resendGate={phoneGate}
                      role={role}
                    />
                  )}
                </div>
              )}

                </div>

                <div className="ob-profile-col ob-address">
                  <AddressFields
                    value={address}
                    onChange={setAddress}
                    variant="onboarding"
                    line1Label={isCompany ? 'Company address' : 'Base address'}
                    idPrefix="ob"
                  />
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
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
      </section>
    </main>
  );
}
