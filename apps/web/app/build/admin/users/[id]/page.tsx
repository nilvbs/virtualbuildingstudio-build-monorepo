'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { AdminUserDetail } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../../lib/api';
import { StatusBadge } from '../../../../../components/status';
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
  const [canManage, setCanManage] = useState(true);

  async function load() {
    try {
      const row = await api.getAdminUser(id);
      setUser(row);
      setForm(formFromUser(row));
      setPhone(phoneInputFromE164(row.phone) ?? defaultPhoneInput());
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

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
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
      setCanManage(true);
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

  async function onDelete() {
    if (!user) return;
    const ok = window.confirm(
      `Delete ${user.fullName}? This removes their account, projects, and related data. This cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteAdminUser(user.id);
      router.replace('/build/admin/users');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setCanManage(false);
        setError('You can view this user but do not have permission to delete.');
      } else {
        setError(errorMessage(err));
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

  return (
    <div className="admin-dossier">
      <Link href="/build/admin/users" className="admin-dossier-back plain">
        <ArrowLeft size={15} /> Users
      </Link>

      <header className="admin-dossier-head">
        <div>
          <p className="ops-kicker">User account</p>
          <h1 className="admin-dossier-title">{user.fullName}</h1>
          <p className="admin-dossier-sub">
            {roles || 'No roles'} · @{user.username} · Joined{' '}
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={user.status} />
          {user.roles.includes('client') ? (
            <Link href={`/build/admin/clients/${user.id}`} className="btn secondary sm">
              Client dossier
            </Link>
          ) : null}
          {canManage && !user.isStaff ? (
            <button
              type="button"
              className="btn secondary sm"
              onClick={() => void onDelete()}
              disabled={deleting}
              style={{ color: 'var(--danger, #b42318)' }}
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div className="admin-dossier-grid">
        <section className="admin-dossier-card">
          <h2>Account snapshot</h2>
          <dl className="admin-dossier-dl">
            <div>
              <dt>Email</dt>
              <dd>
                <Mail size={13} aria-hidden /> {user.email}
                {user.emailVerified ? <span className="admin-dossier-ok">Verified</span> : null}
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <Phone size={13} aria-hidden /> {user.phone}
                {user.phoneVerified ? <span className="admin-dossier-ok">Verified</span> : null}
              </dd>
            </div>
            <div>
              <dt>Onboarding</dt>
              <dd>{user.onboardingStep}</dd>
            </div>
            <div>
              <dt>Auth</dt>
              <dd>{user.authProvider ?? '—'}</dd>
            </div>
            <div>
              <dt>Projects posted</dt>
              <dd>{user.projectCount}</dd>
            </div>
            {user.isStaff ? (
              <div>
                <dt>Staff</dt>
                <dd>{user.staffLevel ?? 'admin'} — manage permissions in Staff</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="admin-dossier-card">
          <h2>Location</h2>
          {user.city || user.addressLine1 ? (
            <div className="admin-dossier-address">
              <MapPin size={16} aria-hidden />
              <div>
                {user.addressLine1 ? <div>{user.addressLine1}</div> : null}
                {user.addressLine2 ? <div>{user.addressLine2}</div> : null}
                <div>
                  {[user.city, user.state, user.postalCode].filter(Boolean).join(', ')}
                </div>
                {user.country ? <div>{user.country}</div> : null}
              </div>
            </div>
          ) : (
            <p className="admin-dossier-muted">No address on file.</p>
          )}
          {user.companyName ? (
            <p className="admin-dossier-company">
              <Building2 size={14} aria-hidden /> {user.companyName}
            </p>
          ) : null}
        </section>
      </div>

      <section id="edit" className="admin-dossier-card" style={{ marginTop: 14 }}>
        <div className="admin-dossier-card-head">
          <h2>Edit details</h2>
        </div>
        <form onSubmit={onSave} className="admin-user-edit" style={{ display: 'grid', gap: 12 }}>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="admin-user-first">First name</label>
              <input
                id="admin-user-first"
                className="input"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
                disabled={!canManage}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-last">Last name</label>
              <input
                id="admin-user-last"
                className="input"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="admin-user-email">Email</label>
            <input
              id="admin-user-email"
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              disabled={!canManage}
            />
          </div>

          <div className="field">
            <label>Phone</label>
            <PhoneInput value={phone} onChange={setPhone} disabled={!canManage} />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="admin-user-status">Status</label>
              <select
                id="admin-user-status"
                className="input"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as 'active' | 'suspended' }))
                }
                disabled={!canManage || user.staffLevel === 'super_admin'}
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
                disabled={!canManage}
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="admin-user-company">Company</label>
            <input
              id="admin-user-company"
              className="input"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              disabled={!canManage}
            />
          </div>

          <div className="field">
            <label htmlFor="admin-user-a1">Address line 1</label>
            <input
              id="admin-user-a1"
              className="input"
              value={form.addressLine1}
              onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
              disabled={!canManage}
            />
          </div>
          <div className="field">
            <label htmlFor="admin-user-a2">Address line 2</label>
            <input
              id="admin-user-a2"
              className="input"
              value={form.addressLine2}
              onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
              disabled={!canManage}
            />
          </div>

          <div
            className="form-row"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}
          >
            <div className="field">
              <label htmlFor="admin-user-city">City</label>
              <input
                id="admin-user-city"
                className="input"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-state">State</label>
              <input
                id="admin-user-state"
                className="input"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-zip">Postal code</label>
              <input
                id="admin-user-zip"
                className="input"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="admin-user-country">Country</label>
            <input
              id="admin-user-country"
              className="input"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              disabled={!canManage}
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="admin-user-work">Work email</label>
              <input
                id="admin-user-work"
                className="input"
                type="email"
                value={form.workEmail}
                onChange={(e) => setForm((f) => ({ ...f, workEmail: e.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-user-web">Website</label>
              <input
                id="admin-user-web"
                className="input"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="admin-user-reg">Registration number</label>
            <input
              id="admin-user-reg"
              className="input"
              value={form.registrationNumber}
              onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
              disabled={!canManage}
            />
          </div>

          {canManage ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          ) : (
            <p className="admin-dossier-muted">
              You need the “Edit & delete users” permission to change this account.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
