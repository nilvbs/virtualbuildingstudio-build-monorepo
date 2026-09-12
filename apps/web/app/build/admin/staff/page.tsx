'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  STAFF_PERMISSIONS,
  STAFF_PERMISSION_LABELS,
  STAFF_PERMISSION_PRESET_MAP,
  type StaffAdmin,
  type StaffPermission,
  type StaffPermissionPreset,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import {
  defaultPhoneInput,
  PhoneInput,
  phoneInputIsValid,
  phoneInputToE164,
} from '../../../../components/phone-input';

const PRESETS: { value: StaffPermissionPreset; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'matcher', label: 'Matcher' },
  { value: 'full', label: 'Full admin' },
  { value: 'custom', label: 'Custom' },
];

export default function StaffAdminsPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    title: '',
  });
  const [phone, setPhone] = useState(defaultPhoneInput);
  const [preset, setPreset] = useState<StaffPermissionPreset>('matcher');
  const [customPerms, setCustomPerms] = useState<StaffPermission[]>([
    ...STAFF_PERMISSION_PRESET_MAP.matcher,
  ]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  async function load() {
    try {
      const rows = await api.listStaffAdmins();
      setStaff(rows);
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
  }, [router]);

  const selectedPerms = useMemo(() => {
    if (preset === 'custom') return customPerms;
    return STAFF_PERMISSION_PRESET_MAP[preset];
  }, [preset, customPerms]);

  function togglePerm(p: StaffPermission) {
    setPreset('custom');
    setCustomPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!phoneInputIsValid(phone)) {
      setCreateError('Enter a valid phone number.');
      return;
    }
    if (preset === 'custom' && customPerms.length === 0) {
      setCreateError('Select at least one permission for a custom role.');
      return;
    }
    setCreateBusy(true);
    try {
      const parts = form.fullName.trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] ?? '';
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;
      await api.createStaffAdmin({
        firstName,
        lastName,
        email: form.email.trim(),
        password: form.password,
        phone: phoneInputToE164(phone),
        permissionPreset: preset,
        permissions: selectedPerms,
        title: form.title.trim() || undefined,
      });
      setCreateOpen(false);
      setForm({ fullName: '', email: '', password: '', title: '' });
      setPhone(defaultPhoneInput());
      setPreset('matcher');
      setCustomPerms([...STAFF_PERMISSION_PRESET_MAP.matcher]);
      await load();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreateBusy(false);
    }
  }

  async function onPresetChange(userId: string, next: StaffPermissionPreset) {
    setBusyId(userId);
    try {
      const permissions =
        next === 'custom'
          ? staff?.find((s) => s.id === userId)?.permissions ?? [...STAFF_PERMISSION_PRESET_MAP.matcher]
          : STAFF_PERMISSION_PRESET_MAP[next];
      await api.updateStaffAdmin(userId, { permissionPreset: next, permissions });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onTogglePerm(user: StaffAdmin, permission: StaffPermission) {
    setBusyId(user.id);
    try {
      const next = user.permissions.includes(permission)
        ? user.permissions.filter((p) => p !== permission)
        : [...user.permissions, permission];
      await api.updateStaffAdmin(user.id, {
        permissionPreset: 'custom',
        permissions: next,
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onRemove(userId: string) {
    if (!window.confirm('Remove staff access for this admin?')) return;
    setBusyId(userId);
    try {
      await api.removeStaffAdmin(userId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="card card-pad" style={{ height: 220 }}>
        <div className="skeleton sk-line" style={{ width: '40%' }} />
        <div className="skeleton sk-line" style={{ width: '70%', marginTop: 12 }} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="alert error">
        Only the super admin can manage staff roles and permissions.
      </div>
    );
  }

  return (
    <div className="staff-admin">
      <div className="page-head">
        <div>
          <h1 className="page-title">Staff &amp; permissions</h1>
          <p className="page-sub">
            Invite normal admins, pick a preset, then customize individual actions.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setCreateOpen((o) => !o)}>
          {createOpen ? 'Close' : 'Invite admin'}
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {createOpen && (
        <form className="card card-pad-lg" onSubmit={onCreate} noValidate style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Invite a normal admin</h2>
          {createError && <div className="alert error">{createError}</div>}
          <div className="row">
            <div className="field">
              <label htmlFor="staff-name">Full name</label>
              <input
                id="staff-name"
                required
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-title">Title</label>
              <input
                id="staff-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Operations"
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="staff-email">Work email</label>
              <input
                id="staff-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-password">Temp password</label>
              <input
                id="staff-password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>
          <PhoneInput id="staff-phone" value={phone} onChange={setPhone} required />

          <div className="field">
            <label htmlFor="staff-preset">Permission preset</label>
            <select
              id="staff-preset"
              value={preset}
              onChange={(e) => {
                const next = e.target.value as StaffPermissionPreset;
                setPreset(next);
                if (next !== 'custom') setCustomPerms([...STAFF_PERMISSION_PRESET_MAP[next]]);
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="staff-perm-grid">
            {STAFF_PERMISSIONS.map((p) => (
              <label key={p} className={`check ${selectedPerms.includes(p) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedPerms.includes(p)}
                  onChange={() => togglePerm(p)}
                />
                {STAFF_PERMISSION_LABELS[p]}
              </label>
            ))}
          </div>

          <button className="btn" type="submit" disabled={createBusy} style={{ marginTop: 14 }}>
            {createBusy ? 'Creating…' : 'Create admin'}
          </button>
        </form>
      )}

      <div className="list">
        {(staff ?? []).map((row) => (
          <div className="card card-pad staff-row" key={row.id}>
            <div className="staff-row-top">
              <div>
                <strong>{row.fullName}</strong>
                <div className="row-meta">
                  {row.email}
                  {row.title ? ` · ${row.title}` : ''}
                  {row.staffLevel === 'super_admin' ? ' · Super admin' : ''}
                </div>
              </div>
              {row.staffLevel !== 'super_admin' && (
                <button
                  type="button"
                  className="btn secondary sm"
                  disabled={busyId === row.id}
                  onClick={() => onRemove(row.id)}
                >
                  Remove
                </button>
              )}
            </div>

            {row.staffLevel === 'super_admin' ? (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Super admin has every action and manages other staff.
              </p>
            ) : (
              <>
                <div className="field" style={{ marginTop: 12, marginBottom: 8 }}>
                  <label htmlFor={`preset-${row.id}`}>Preset</label>
                  <select
                    id={`preset-${row.id}`}
                    value={row.permissionPreset}
                    disabled={busyId === row.id}
                    onChange={(e) =>
                      onPresetChange(row.id, e.target.value as StaffPermissionPreset)
                    }
                  >
                    {PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="staff-perm-grid">
                  {STAFF_PERMISSIONS.map((p) => (
                    <label
                      key={p}
                      className={`check ${row.permissions.includes(p) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={row.permissions.includes(p)}
                        disabled={busyId === row.id}
                        onChange={() => onTogglePerm(row, p)}
                      />
                      {STAFF_PERMISSION_LABELS[p]}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
