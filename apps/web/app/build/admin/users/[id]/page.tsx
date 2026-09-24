'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  PauseCircle,
  Pencil,
  Phone,
  ShieldAlert,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import type { AdminUserDetail } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../../lib/api';
import { toastError, toastSuccess } from '../../../../../lib/action-toast';
import { displayPhone, isPlaceholderPhone } from '../../../../../lib/country-codes';
import { AdminSurveyorPortfolioDrawer } from '../../../../../components/admin-surveyor-portfolio-drawer';
import {
  defaultPhoneInput,
  PhoneInput,
  phoneInputFromE164,
  phoneInputIsValid,
  phoneInputToE164,
  type PhoneInputValue,
} from '../../../../../components/phone-input';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'suspended';
  accountType: 'individual' | 'company';
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  workEmail: string;
  website: string;
  registrationNumber: string;
};

function emptyForm(): FormState {
  return {
    firstName: '',
    lastName: '',
    email: '',
    status: 'active',
    accountType: 'individual',
    companyName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    workEmail: '',
    website: '',
    registrationNumber: '',
  };
}

function formFromUser(u: AdminUserDetail): FormState {
  return {
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    status: u.status,
    accountType: u.accountType === 'company' ? 'company' : 'individual',
    companyName: u.companyName ?? '',
    addressLine1: u.addressLine1 ?? '',
    addressLine2: u.addressLine2 ?? '',
    city: u.city ?? '',
    state: u.state ?? '',
    postalCode: u.postalCode ?? '',
    country: u.country ?? '',
    workEmail: u.workEmail ?? '',
    website: u.website ?? '',
    registrationNumber: u.registrationNumber ?? '',
  };
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [phone, setPhone] = useState<PhoneInputValue>(defaultPhoneInput());
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [verifyChannel, setVerifyChannel] = useState<'email' | 'phone' | null>(null);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [unlockingOtp, setUnlockingOtp] = useState(false);

  function enterEdit() {
    if (!user || !canManage) return;
    setForm(formFromUser(user));
    setPhone(
      isPlaceholderPhone(user.phone)
        ? defaultPhoneInput()
        : (phoneInputFromE164(user.phone) ?? defaultPhoneInput()),
    );
    setError(null);
    setVerifyChannel(null);
    setVerifyPassword('');
    setEditing(true);
  }

  function cancelEdit() {
    if (!user) return;
    setForm(formFromUser(user));
    setPhone(
      isPlaceholderPhone(user.phone)
        ? defaultPhoneInput()
        : (phoneInputFromE164(user.phone) ?? defaultPhoneInput()),
    );
    setError(null);
    setVerifyChannel(null);
    setVerifyPassword('');
    setEditing(false);
  }

  async function load() {
    try {
      const row = await api.getAdminUser(id);
      setUser(row);
      setForm(formFromUser(row));
      setPhone(
        isPlaceholderPhone(row.phone)
          ? defaultPhoneInput()
          : (phoneInputFromE164(row.phone) ?? defaultPhoneInput()),
      );
      setForbidden(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
      else if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!confirmDeleteOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) setConfirmDeleteOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [confirmDeleteOpen, deleting]);

  useEffect(() => {
    void api
      .me()
      .then((me) => {
        setIsSuperAdmin(me.staffLevel === 'super_admin');
        setCanManage(
          me.staffLevel === 'super_admin' || Boolean(me.permissions?.includes('users:manage')),
        );
      })
      .catch(() => {
        /* detail call still gates access */
      });
  }, []);

  async function onVerifyContact() {
    if (!user || !verifyChannel) return;
    if (!verifyPassword.trim()) {
      setError('Enter your password to confirm.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const updated = await api.verifyAdminUserContact(user.id, {
        channel: verifyChannel,
        password: verifyPassword,
      });
      setUser(updated);
      setForm(formFromUser(updated));
      setVerifyChannel(null);
      setVerifyPassword('');
      toastSuccess(
        verifyChannel === 'email' ? 'Email marked verified' : 'Phone marked verified',
      );
    } catch (err) {
      setError(errorMessage(err));
      toastError(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  async function onUnlockOtp() {
    if (!user || unlockingOtp) return;
    setUnlockingOtp(true);
    setError(null);
    try {
      const updated = await api.unlockAdminUserOtp(user.id);
      setUser(updated);
      toastSuccess('OTP lockout cleared — user can request codes again');
    } catch (err) {
      setError(errorMessage(err));
      toastError(errorMessage(err));
    } finally {
      setUnlockingOtp(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user || !editing || !canManage) return;
    setError(null);
    if (!phoneInputIsValid(phone)) {
      setError('Enter a valid phone number.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateAdminUser(user.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: phoneInputToE164(phone),
        status: form.status,
        accountType: form.accountType,
        companyName: form.companyName.trim() || null,
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        workEmail: form.workEmail.trim() || null,
        website: form.website.trim() || null,
        registrationNumber: form.registrationNumber.trim() || null,
      });
      setUser(updated);
      setForm(formFromUser(updated));
      setPhone(
        isPlaceholderPhone(updated.phone)
          ? defaultPhoneInput()
          : (phoneInputFromE164(updated.phone) ?? defaultPhoneInput()),
      );
      setCanManage(true);
      setEditing(false);
      setVerifyChannel(null);
      setVerifyPassword('');
      toastSuccess('Saved', 'Account details updated.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setCanManage(false);
        setError('You can view this user but do not have permission to edit.');
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!user) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteAdminUser(user.id);
      toastSuccess('User deleted', `${user.fullName} was removed.`);
      setConfirmDeleteOpen(false);
      router.replace('/build/admin/users');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Global onUnauthorized already clears session + redirects to login.
        return;
      }
      const message = errorMessage(err);
      if (err instanceof ApiError && err.status === 403) {
        setCanManage(false);
        setError('You can view this user but do not have permission to delete.');
        toastError('Delete failed', 'You do not have permission to delete this user.');
      } else {
        setError(message);
        toastError('Delete failed', message);
      }
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-dossier">
        <div className="skeleton sk-line" style={{ width: 180, height: 22 }} />
        <div className="card" style={{ marginTop: 16, height: 220 }} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="empty">
        <div className="empty-ico">
          <ShieldAlert size={24} />
        </div>
        <h3 style={{ fontSize: 18 }}>No access to users</h3>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="alert error">{error ?? 'User not found.'}</div>
        <Link href="/build/admin/users" className="btn secondary sm">
          <ArrowLeft size={15} /> Back to users
        </Link>
      </>
    );
  }

  const roles = user.roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' · ');

  const deleteModal =
    confirmDeleteOpen && mounted
      ? createPortal(
          <div className="sheet-modal" role="presentation">
            <button
              type="button"
              className="sheet-modal-backdrop"
              aria-label="Dismiss"
              disabled={deleting}
              onClick={() => setConfirmDeleteOpen(false)}
            />
            <div
              className="sheet-modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-delete-user-detail-title"
            >
              <button
                type="button"
                className="sheet-modal-close"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <p className="kicker" style={{ marginBottom: 6 }}>
                Delete account
              </p>
              <h2 id="admin-delete-user-detail-title" className="sheet-modal-title">
                Delete {user.fullName}?
              </h2>
              <p className="sheet-modal-copy">
                This removes their account, projects, and related data. This cannot be undone.
              </p>
              <div className="sheet-modal-actions">
                <button
                  type="button"
                  className="btn block"
                  disabled={deleting}
                  onClick={() => void confirmDelete()}
                  style={{ background: 'var(--danger, #b42318)', borderColor: 'transparent' }}
                >
                  {deleting ? (
                    <>
                      <Loader2 size={16} className="hd-action-toast-spin" aria-hidden />
                      Deleting…
                    </>
                  ) : (
                    'Delete user'
                  )}
                </button>
                <button
                  type="button"
                  className="btn secondary block"
                  disabled={deleting}
                  onClick={() => setConfirmDeleteOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="admin-dossier admin-dossier--user">
      {deleteModal}
      <Link href="/build/admin/users" className="admin-dossier-back plain">
        <ArrowLeft size={15} /> Back to users
      </Link>

      <header className="admin-dossier-head admin-user-head">
        <div className="admin-user-head-main">
          <span className="admin-user-avatar" aria-hidden>
            {(user.firstName?.[0] ?? user.fullName?.[0] ?? '?').toUpperCase()}
            {(user.lastName?.[0] ?? '').toUpperCase()}
          </span>
          <div>
            <h1 className="admin-dossier-title">{user.fullName}</h1>
            <p className="admin-dossier-sub">
              {roles || 'No roles'} · @{user.username} · Joined{' '}
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="admin-user-head-actions">
          <span
            className={`admin-user-ico admin-user-ico--status is-${user.status}`}
            title={user.status === 'active' ? 'Active' : 'Suspended'}
            aria-label={user.status === 'active' ? 'Status: Active' : 'Status: Suspended'}
          >
            {user.status === 'active' ? (
              <CheckCircle2 size={16} aria-hidden />
            ) : (
              <PauseCircle size={16} aria-hidden />
            )}
          </span>
          {user.roles.includes('client') ? (
            <Link
              href={`/build/admin/clients/${user.id}`}
              className="admin-user-ico admin-user-ico--client"
              title="Client dossier"
              aria-label="Client dossier"
            >
              <Building2 size={15} aria-hidden />
            </Link>
          ) : null}
          {user.roles.includes('surveyor') ? (
            <button
              type="button"
              className="admin-user-ico admin-user-ico--portfolio"
              onClick={() => setPortfolioOpen(true)}
              title="View portfolio"
              aria-label="View portfolio"
            >
              <Briefcase size={15} aria-hidden />
            </button>
          ) : null}
          {canManage && !editing ? (
            <button
              type="button"
              className="admin-user-ico admin-user-ico--edit"
              onClick={enterEdit}
              aria-label="Edit user"
              title="Edit"
            >
              <Pencil size={15} aria-hidden />
            </button>
          ) : null}
          {canManage && editing ? (
            <button
              type="button"
              className="admin-user-ico admin-user-ico--cancel"
              onClick={cancelEdit}
              disabled={saving}
              aria-label="Cancel edit"
              title="Cancel edit"
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
          {canManage && !user.isStaff ? (
            <button
              type="button"
              className="admin-user-ico admin-user-ico--danger"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting || editing}
              aria-label={deleting ? 'Deleting' : 'Delete user'}
              title={deleting ? 'Deleting…' : 'Delete'}
            >
              {deleting ? (
                <Loader2 size={15} className="hd-action-toast-spin" aria-hidden />
              ) : (
                <Trash2 size={15} aria-hidden />
              )}
            </button>
          ) : null}
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      {user.otpLockouts?.some((l) => l.locked) ? (
        <section className="admin-dossier-card admin-user-otp-lockout" role="alert">
          <div className="admin-dossier-card-head">
            <h2>
              <ShieldAlert size={18} aria-hidden /> OTP verification locked
            </h2>
            {canManage ? (
              <button
                type="button"
                className="btn secondary sm"
                disabled={unlockingOtp}
                onClick={() => void onUnlockOtp()}
              >
                {unlockingOtp ? (
                  <>
                    <Loader2 size={14} className="hd-action-toast-spin" aria-hidden />
                    Unlocking…
                  </>
                ) : (
                  <>
                    <Unlock size={14} aria-hidden />
                    Clear OTP lockout
                  </>
                )}
              </button>
            ) : null}
          </div>
          <ul className="admin-user-otp-lockout-list">
            {user.otpLockouts
              .filter((l) => l.locked)
              .map((l) => (
                <li key={l.channel}>
                  <strong>
                    {l.channel === 'work_email'
                      ? 'Work email'
                      : l.channel === 'phone'
                        ? 'Phone'
                        : 'Email'}
                  </strong>
                  {' · '}
                  {l.sendsUsed} codes
                  {l.unlockAt
                    ? ` · auto-unlocks ${new Date(l.unlockAt).toLocaleString()}`
                    : null}
                </li>
              ))}
          </ul>
          <p className="admin-dossier-sub" style={{ margin: '8px 0 0' }}>
            Clearing the lockout lets this user request verification codes again immediately.
          </p>
        </section>
      ) : null}

      {editing && verifyChannel ? (
        <section className="admin-dossier-card admin-user-verify">
          <h2>Confirm {verifyChannel} verification</h2>
          <p className="admin-dossier-sub" style={{ marginBottom: 12 }}>
            Enter your super admin password to mark this user&apos;s {verifyChannel} as verified.
          </p>
          <div className="admin-user-verify-row">
            <label className="field" style={{ flex: '1 1 220px', margin: 0 }}>
              <span className="label">Your password</span>
              <input
                type="password"
                className="input"
                autoComplete="current-password"
                value={verifyPassword}
                onChange={(e) => setVerifyPassword(e.target.value)}
                placeholder="Super admin password"
              />
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={verifying}
              onClick={() => void onVerifyContact()}
            >
              {verifying ? 'Verifying…' : `Verify ${verifyChannel}`}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={verifying}
              onClick={() => {
                setVerifyChannel(null);
                setVerifyPassword('');
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <div className="admin-user-meta">
        <div className="admin-user-meta-item">
          <span className="admin-user-meta-label">Email</span>
          <span className="admin-user-meta-value">
            <Mail size={13} aria-hidden />
            <span className="admin-user-meta-text">{user.email}</span>
            {user.emailVerified ? (
              <span className="admin-dossier-ok">Verified</span>
            ) : editing && isSuperAdmin ? (
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => {
                  setVerifyChannel('email');
                  setVerifyPassword('');
                  setError(null);
                }}
              >
                Verify
              </button>
            ) : (
              <span className="admin-user-muted">Unverified</span>
            )}
          </span>
        </div>
        <div className="admin-user-meta-item">
          <span className="admin-user-meta-label">Phone</span>
          <span className="admin-user-meta-value">
            <Phone size={13} aria-hidden />
            <span className="admin-user-meta-text">{displayPhone(user.phone)}</span>
            {user.phoneVerified && !isPlaceholderPhone(user.phone) ? (
              <span className="admin-dossier-ok">Verified</span>
            ) : editing && isSuperAdmin && !isPlaceholderPhone(user.phone) ? (
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => {
                  setVerifyChannel('phone');
                  setVerifyPassword('');
                  setError(null);
                }}
              >
                Verify
              </button>
            ) : isPlaceholderPhone(user.phone) ? (
              <span className="admin-user-muted">Not set</span>
            ) : (
              <span className="admin-user-muted">Unverified</span>
            )}
          </span>
        </div>
        <div className="admin-user-meta-item">
          <span className="admin-user-meta-label">Onboarding</span>
          <span className="admin-user-meta-value">
            <code className="admin-user-code">{user.onboardingStep}</code>
          </span>
        </div>
        <div className="admin-user-meta-item">
          <span className="admin-user-meta-label">Location</span>
          <span className="admin-user-meta-value">
            <MapPin size={13} aria-hidden />
            <span className="admin-user-meta-text">
              {user.city || user.state || user.country
                ? [user.city, user.state, user.country].filter(Boolean).join(', ')
                : user.addressLine1 || 'No address on file'}
            </span>
          </span>
        </div>
      </div>

      <AdminSurveyorPortfolioDrawer
        userId={user.id}
        open={portfolioOpen}
        onClose={() => setPortfolioOpen(false)}
        canEdit={canManage}
      />

      <section id="edit" className={`admin-dossier-card admin-user-edit-card${editing ? ' is-editing' : ''}`}>
        <div className="admin-dossier-card-head">
          <h2>{editing ? 'Edit details' : 'Details'}</h2>
        </div>
        <form onSubmit={onSave} className="admin-user-edit">
          <fieldset className="admin-user-edit-fields" disabled={!editing}>
          <div className="admin-user-edit-grid">
            <p className="admin-user-section admin-user-span-4">Identity</p>
            <div className="field">
              <label htmlFor="admin-user-first">First name</label>
              <input
                id="admin-user-first"
                className="input"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required={editing}
                readOnly={!editing}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-last">Last name</label>
              <input
                id="admin-user-last"
                className="input"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required={editing}
                readOnly={!editing}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-status">Status</label>
              <select
                id="admin-user-status"
                className="input"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as 'active' | 'suspended' }))
                }
                disabled={!editing || user.staffLevel === 'super_admin'}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="admin-user-type">Account type</label>
              <select
                id="admin-user-type"
                className="input"
                value={form.accountType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    accountType: e.target.value as 'individual' | 'company',
                  }))
                }
                disabled={!editing}
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            </div>

            <p className="admin-user-section admin-user-span-4">Contact</p>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-email">Email</label>
              <input
                id="admin-user-email"
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required={editing}
                readOnly={!editing}
              />
            </div>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-phone">Phone</label>
              <PhoneInput
                id="admin-user-phone"
                label={null}
                value={phone}
                onChange={setPhone}
                disabled={!editing}
              />
            </div>

            <p className="admin-user-section admin-user-span-4">Address</p>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-a1">Address line 1</label>
              <input
                id="admin-user-a1"
                className="input"
                value={form.addressLine1}
                onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-a2">Address line 2</label>
              <input
                id="admin-user-a2"
                className="input"
                value={form.addressLine2}
                onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-city">City</label>
              <input
                id="admin-user-city"
                className="input"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-state">State</label>
              <input
                id="admin-user-state"
                className="input"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-zip">Postal code</label>
              <input
                id="admin-user-zip"
                className="input"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-country">Country</label>
              <input
                id="admin-user-country"
                className="input"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                readOnly={!editing}
              />
            </div>

            <p className="admin-user-section admin-user-span-4">Company</p>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-company">Company name</label>
              <input
                id="admin-user-company"
                className="input"
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-reg">Registration number</label>
              <input
                id="admin-user-reg"
                className="input"
                value={form.registrationNumber}
                onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-work">Work email</label>
              <input
                id="admin-user-work"
                className="input"
                type="email"
                value={form.workEmail}
                onChange={(e) => setForm((f) => ({ ...f, workEmail: e.target.value }))}
                readOnly={!editing}
              />
            </div>
            <div className="field admin-user-span-2">
              <label htmlFor="admin-user-web">Website</label>
              <input
                id="admin-user-web"
                className="input"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                readOnly={!editing}
                placeholder="https://"
              />
            </div>
          </div>
          </fieldset>

          {editing && canManage ? (
            <div className="admin-user-edit-actions">
              <button type="button" className="btn secondary" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          ) : null}

          {!canManage ? (
            <p className="admin-dossier-muted">
              You need the “Edit & delete users” permission to change this account.
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
