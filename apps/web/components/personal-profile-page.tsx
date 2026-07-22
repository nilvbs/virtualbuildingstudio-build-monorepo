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

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

function VerificationBadge({ verified }: { verified: boolean }) {
  return (
    <span className={`personal-verify${verified ? ' is-verified' : ' is-pending'}`}>
      {verified ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      {verified ? 'Verified' : 'Not verified'}
    </span>
  );
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

  return (
    <div className="personal-profile">
      <header className="personal-profile-head">
        <div>
          <p className="kicker">Account</p>
          <h1>Personal profile</h1>
          <p>Your identity, contact details, and verification status.</p>
        </div>
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
                size={22}
                aria-label="Email and mobile verified"
              />
            ) : null}
          </h2>
        </section>

        <section className="personal-profile-card">
          <h2>Contact details</h2>
          <div className="personal-contact-list">
            <div className="personal-contact-row">
              <span className="personal-contact-icon"><AtSign size={18} /></span>
              <span className="personal-contact-copy">
                <small>Email address</small>
                <strong>{user.email}</strong>
              </span>
              <VerificationBadge verified={user.emailVerified} />
            </div>
            <div className="personal-contact-row">
              <span className="personal-contact-icon"><Phone size={18} /></span>
              <span className="personal-contact-copy">
                <small>Phone number</small>
                <strong>{user.phone}</strong>
              </span>
              <VerificationBadge verified={user.phoneVerified} />
            </div>
          </div>
          {(!user.emailVerified || !user.phoneVerified) && (
            <a className="btn secondary" href="/onboarding">
              Complete verification
            </a>
          )}
        </section>

        <section className="personal-profile-card personal-profile-edit">
          <div className="personal-details-heading">
            <h2>Personal details</h2>
            {!editing && (
              <button type="button" className="personal-details-edit-button" onClick={startEditing}>
                <Pencil size={15} />
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

            <div className="field">
              <label htmlFor="personal-line1">{isCompany ? 'Company address' : 'Base address'}</label>
              <input
                id="personal-line1"
                value={address.line1}
                onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                disabled={!editing}
                required={editing}
                placeholder={editing ? 'Address line 1' : '—'}
              />
            </div>
            <div className="field">
              <label htmlFor="personal-line2">Address line 2 (optional)</label>
              <input
                id="personal-line2"
                value={address.line2}
                onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                disabled={!editing}
                placeholder={editing ? 'Optional' : '—'}
              />
            </div>
            <div className="field">
              <label htmlFor="personal-city">City</label>
              <input
                id="personal-city"
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                disabled={!editing}
                required={editing}
                placeholder={editing ? 'City' : '—'}
              />
            </div>
            <div className="field">
              <label htmlFor="personal-state">State / region</label>
              <input
                id="personal-state"
                value={address.state}
                onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                disabled={!editing}
                required={editing}
                placeholder={editing ? 'State / region' : '—'}
              />
            </div>
            <div className="field">
              <label htmlFor="personal-postal">Postal code</label>
              <input
                id="personal-postal"
                value={address.postalCode}
                onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                disabled={!editing}
                required={editing}
                placeholder={editing ? 'Postal code' : '—'}
              />
            </div>
            <div className="field">
              <label htmlFor="personal-country">Country</label>
              <input
                id="personal-country"
                value={address.country}
                onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                disabled={!editing}
                required={editing}
                placeholder={editing ? 'Country' : '—'}
              />
            </div>

            {editing && (
              <div className="personal-details-actions">
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="btn secondary" disabled={busy} onClick={() => void cancelEditing()}>
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
