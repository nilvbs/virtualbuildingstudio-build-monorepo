'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AtSign,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { AuthenticatedUser, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';

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
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.me(), api.getOnboarding()])
      .then(([nextUser, onboarding]) => {
        setUser(nextUser);
        setFullName(nextUser.fullName);
        setCompanyName(onboarding.companyName ?? '');
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSavedMessage(null);
    setError(null);
    try {
      const next = await api.updateMe({
        fullName: fullName.trim(),
        ...(role === 'client' ? { companyName: companyName.trim() || null } : {}),
      });
      setUser(next);
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
    if (!user) return;
    setFullName(user.fullName);
    setSavedMessage(null);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (!user) return;
    setFullName(user.fullName);
    setEditing(false);
    setError(null);
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
    return <div className="personal-profile-card skeleton" style={{ minHeight: 420 }} />;
  }

  const avatarIsUrl = /^(https?:\/\/|\/)/.test(user.avatarKey ?? '');

  return (
    <div className="personal-profile">
      <header className="personal-profile-head">
        <div>
          <p className="kicker">Account</p>
          <h1>Personal profile</h1>
          <p>Your identity, contact details, and verification status.</p>
        </div>
        <div className="personal-profile-trust">
          <ShieldCheck size={20} />
          <span>
            <strong>{user.emailVerified && user.phoneVerified ? 'Fully verified' : 'Verification pending'}</strong>
            <small>Your contact status is visible here at any time.</small>
          </span>
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
              {uploadingPhoto ? <LoaderCircle size={16} className="spin" /> : <Pencil size={15} />}
            </button>
          </div>
          <h2>{user.fullName}</h2>
          <p>{role === 'surveyor' ? 'Expert (surveyor)' : 'Client'}</p>
          <div className="personal-identity-role">
            <UserRound size={16} />
            {role === 'surveyor' ? 'Surveyor workspace' : 'Client workspace'}
          </div>
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
              <input
                id="personal-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!editing}
                required
              />
            </div>
            {role === 'client' && (
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
            {editing && (
              <div className="personal-details-actions">
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="btn secondary" disabled={busy} onClick={cancelEditing}>
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
