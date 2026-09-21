'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Pencil, Shield, Trash2, UserPlus, X } from 'lucide-react';
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export default function StaffAdminsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [staff, setStaff] = useState<StaffAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffAdmin | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    title: '',
  });
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [phone, setPhone] = useState(defaultPhoneInput);
  const [preset, setPreset] = useState<StaffPermissionPreset>('matcher');
  const [customPerms, setCustomPerms] = useState<StaffPermission[]>([
    ...STAFF_PERMISSION_PRESET_MAP.matcher,
  ]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: '',
    title: '',
    password: '',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editPreset, setEditPreset] = useState<StaffPermissionPreset>('matcher');
  const [editPerms, setEditPerms] = useState<StaffPermission[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

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
    setMounted(true);
  }, []);

  useEffect(() => {
    void load();
  }, [router]);

  const selectedPerms = useMemo(() => {
    if (preset === 'custom') return customPerms;
    return STAFF_PERMISSION_PRESET_MAP[preset];
  }, [preset, customPerms]);

  const editSelectedPerms = useMemo(() => {
    if (editPreset === 'custom') return editPerms;
    return STAFF_PERMISSION_PRESET_MAP[editPreset];
  }, [editPreset, editPerms]);

  function togglePerm(p: StaffPermission) {
    setPreset('custom');
    setCustomPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function toggleEditPerm(p: StaffPermission) {
    setEditPreset('custom');
    setEditPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function resetInviteForm() {
    setForm({ fullName: '', email: '', password: '', title: '' });
    setPhone(defaultPhoneInput());
    setPreset('matcher');
    setCustomPerms([...STAFF_PERMISSION_PRESET_MAP.matcher]);
    setShowInvitePassword(false);
    setCreateError(null);
  }

  function openEdit(row: StaffAdmin) {
    setEditTarget(row);
    setEditForm({
      fullName: row.fullName,
      title: row.title ?? '',
      password: '',
    });
    setEditPreset(row.permissionPreset);
    setEditPerms([...row.permissions]);
    setShowEditPassword(false);
    setEditError(null);
    setInviteOpen(false);
  }

  function closeDrawers() {
    setInviteOpen(false);
    setEditTarget(null);
    setShowInvitePassword(false);
    setShowEditPassword(false);
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
      const { firstName, lastName } = splitName(form.fullName);
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
      resetInviteForm();
      setInviteOpen(false);
      await load();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreateBusy(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    const isSuper = editTarget.staffLevel === 'super_admin';
    if (!isSuper && editPreset === 'custom' && editSelectedPerms.length === 0) {
      setEditError('Select at least one permission for a custom role.');
      return;
    }
    setEditBusy(true);
    try {
      const { firstName, lastName } = splitName(editForm.fullName);
      await api.updateStaffAdmin(editTarget.id, {
        firstName,
        lastName,
        title: editForm.title.trim() || null,
        ...(editForm.password.trim() ? { password: editForm.password.trim() } : {}),
        ...(!isSuper
          ? {
              permissionPreset: editPreset,
              permissions: editSelectedPerms,
            }
          : {}),
      });
      setEditTarget(null);
      await load();
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setEditBusy(false);
    }
  }

  async function onRemove(userId: string) {
    if (!window.confirm('Remove staff access for this admin?')) return;
    setBusyId(userId);
    try {
      await api.removeStaffAdmin(userId);
      if (editTarget?.id === userId) setEditTarget(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="staff-admin">
        <div className="skeleton" style={{ minHeight: 40, borderRadius: 12 }} />
        <div className="skeleton" style={{ minHeight: 72, borderRadius: 12 }} />
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

  const rows = staff ?? [];
  const drawerOpen = inviteOpen || Boolean(editTarget);

  return (
    <div className="staff-admin">
      <div className="staff-admin-top">
        <p className="staff-admin-lead">
          Invite normal admins, edit profiles and passwords, and manage permissions.
        </p>
        <button
          type="button"
          className={`staff-admin-invite-btn${inviteOpen ? ' is-open' : ''}`}
          onClick={() => {
            setEditTarget(null);
            setInviteOpen((o) => !o);
            if (!inviteOpen) resetInviteForm();
          }}
          aria-label={inviteOpen ? 'Close invite' : 'Invite admin'}
          title={inviteOpen ? 'Close' : 'Invite admin'}
        >
          {inviteOpen ? <X size={16} aria-hidden /> : <UserPlus size={15} aria-hidden />}
        </button>
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <div className="staff-admin-list">
        {rows.length === 0 ? (
          <div className="staff-admin-empty">
            <span className="staff-admin-empty-ico" aria-hidden>
              <Shield size={18} />
            </span>
            <h2>No staff yet</h2>
            <p>Invite an admin to start sharing operations access.</p>
          </div>
        ) : (
          rows.map((row) => (
            <article className="staff-row" key={row.id}>
              <div className="staff-row-top">
                <div className="staff-row-identity">
                  <span
                    className={`staff-row-avatar${row.staffLevel === 'super_admin' ? ' is-super' : ''}`}
                    aria-hidden
                  >
                    {row.staffLevel === 'super_admin' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/brand/bld-logo-dark.png"
                        alt=""
                        className="staff-row-avatar-logo"
                      />
                    ) : (
                      initials(row.fullName)
                    )}
                  </span>
                  <div className="staff-row-copy">
                    <div className="staff-row-name">
                      <strong>{row.fullName}</strong>
                      {row.staffLevel === 'super_admin' ? (
                        <span className="staff-row-badge">Super admin</span>
                      ) : (
                        <span className="staff-row-badge is-preset">
                          {PRESETS.find((p) => p.value === row.permissionPreset)?.label ??
                            row.permissionPreset}
                        </span>
                      )}
                      {row.invitePending ? (
                        <span className="staff-row-badge is-invite">Invite pending</span>
                      ) : null}
                    </div>
                    <p className="staff-row-meta">
                      {row.email}
                      {row.title ? ` · ${row.title}` : ''}
                    </p>
                  </div>
                </div>
                <div className="staff-row-aside">
                  <button
                    type="button"
                    className="admin-user-ico"
                    onClick={() => openEdit(row)}
                    aria-label="Edit staff member"
                    title="Edit"
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                  {row.staffLevel === 'super_admin' ? null : (
                    <button
                      type="button"
                      className="admin-user-ico admin-user-ico--danger"
                      disabled={busyId === row.id}
                      onClick={() => void onRemove(row.id)}
                      aria-label="Remove staff access"
                      title="Remove"
                    >
                      {busyId === row.id ? (
                        <Loader2 size={15} className="hd-action-toast-spin" aria-hidden />
                      ) : (
                        <Trash2 size={15} aria-hidden />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {mounted && drawerOpen
        ? createPortal(
            <div className="hd-drawer-root is-open" role="presentation">
              <button
                type="button"
                className="hd-drawer-backdrop"
                aria-label="Close drawer"
                onClick={closeDrawers}
              />
              <aside
                className="hd-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="staff-drawer-title"
              >
          {inviteOpen ? (
            <>
              <div className="hd-drawer-head">
                <div className="hd-drawer-brand">
                  <span className="hd-drawer-ico" aria-hidden>
                    <UserPlus size={16} />
                  </span>
                  <div>
                    <h2 id="staff-drawer-title">Invite a normal admin</h2>
                    <p className="hd-drawer-sub">
                      They get an email and mobile notice with an Access portal link (3 days,
                      Mon–Fri).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="hd-drawer-close"
                  onClick={closeDrawers}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="hd-drawer-body">
                <form className="staff-admin-invite staff-admin-invite--drawer" onSubmit={onCreate} noValidate>
                  {createError ? <div className="alert error">{createError}</div> : null}
                  <div className="staff-admin-invite-grid">
                    <label className="staff-admin-field">
                      <span>Full name</span>
                      <input
                        className="staff-admin-input"
                        required
                        value={form.fullName}
                        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      />
                    </label>
                    <label className="staff-admin-field">
                      <span>Title</span>
                      <input
                        className="staff-admin-input"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Operations"
                      />
                    </label>
                    <label className="staff-admin-field">
                      <span>Work email</span>
                      <input
                        className="staff-admin-input"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </label>
                    <label className="staff-admin-field">
                      <span>Temp password</span>
                      <div className="staff-admin-password">
                        <input
                          className="staff-admin-input"
                          type={showInvitePassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={form.password}
                          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="staff-admin-eye"
                          onClick={() => setShowInvitePassword((v) => !v)}
                          aria-label={showInvitePassword ? 'Hide password' : 'Show password'}
                        >
                          {showInvitePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </label>
                    <div className="staff-admin-field staff-admin-span-2">
                      <PhoneInput id="staff-phone" value={phone} onChange={setPhone} required />
                    </div>
                    <label className="staff-admin-field staff-admin-span-2">
                      <span>Permission preset</span>
                      <select
                        className="staff-admin-input"
                        value={preset}
                        onChange={(e) => {
                          const next = e.target.value as StaffPermissionPreset;
                          setPreset(next);
                          if (next !== 'custom') {
                            setCustomPerms([...STAFF_PERMISSION_PRESET_MAP[next]]);
                          }
                        }}
                      >
                        {PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="staff-perm-grid">
                    {STAFF_PERMISSIONS.map((p) => (
                      <label
                        key={p}
                        className={`check ${selectedPerms.includes(p) ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPerms.includes(p)}
                          onChange={() => togglePerm(p)}
                        />
                        {STAFF_PERMISSION_LABELS[p]}
                      </label>
                    ))}
                  </div>

                  <div className="staff-admin-invite-foot">
                    <button type="button" className="btn secondary sm" onClick={closeDrawers}>
                      Cancel
                    </button>
                    <button className="btn primary sm" type="submit" disabled={createBusy}>
                      {createBusy ? (
                        <>
                          <Loader2 size={14} className="hd-action-toast-spin" aria-hidden />
                          Creating…
                        </>
                      ) : (
                        'Create admin'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : null}

          {editTarget ? (
            <>
              <div className="hd-drawer-head">
                <div className="hd-drawer-brand">
                  <span className="hd-drawer-ico" aria-hidden>
                    <Pencil size={16} />
                  </span>
                  <div>
                    <h2 id="staff-drawer-title">Edit staff</h2>
                    <p className="hd-drawer-sub">
                      {editTarget.staffLevel === 'super_admin'
                        ? 'Update profile or password for the super admin.'
                        : 'Update profile, password, and permissions.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="hd-drawer-close"
                  onClick={closeDrawers}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="hd-drawer-body">
                <form
                  className="staff-admin-invite staff-admin-invite--drawer"
                  onSubmit={onSaveEdit}
                  noValidate
                >
                  {editError ? <div className="alert error">{editError}</div> : null}
                  <div className="staff-admin-invite-grid">
                    <label className="staff-admin-field">
                      <span>Full name</span>
                      <input
                        className="staff-admin-input"
                        required
                        value={editForm.fullName}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, fullName: e.target.value }))
                        }
                      />
                    </label>
                    <label className="staff-admin-field">
                      <span>Title</span>
                      <input
                        className="staff-admin-input"
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </label>
                    <label className="staff-admin-field staff-admin-span-2">
                      <span>New password</span>
                      <div className="staff-admin-password">
                        <input
                          className="staff-admin-input"
                          type={showEditPassword ? 'text' : 'password'}
                          minLength={8}
                          value={editForm.password}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, password: e.target.value }))
                          }
                          placeholder="••••••••"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="staff-admin-eye"
                          onClick={() => setShowEditPassword((v) => !v)}
                          aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                        >
                          {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <span className="staff-admin-hint">
                        Leave blank to keep the current password. Only super admin can change
                        passwords.
                      </span>
                    </label>
                    {editTarget.staffLevel === 'super_admin' ? null : (
                      <label className="staff-admin-field staff-admin-span-2">
                        <span>Permission preset</span>
                        <select
                          className="staff-admin-input"
                          value={editPreset}
                          onChange={(e) => {
                            const next = e.target.value as StaffPermissionPreset;
                            setEditPreset(next);
                            if (next !== 'custom') {
                              setEditPerms([...STAFF_PERMISSION_PRESET_MAP[next]]);
                            }
                          }}
                        >
                          {PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {editTarget.staffLevel === 'super_admin' ? null : (
                    <div className="staff-perm-grid">
                      {STAFF_PERMISSIONS.map((p) => (
                        <label
                          key={p}
                          className={`check ${editSelectedPerms.includes(p) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={editSelectedPerms.includes(p)}
                            onChange={() => toggleEditPerm(p)}
                          />
                          {STAFF_PERMISSION_LABELS[p]}
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="staff-admin-invite-foot">
                    <button type="button" className="btn secondary sm" onClick={closeDrawers}>
                      Cancel
                    </button>
                    <button className="btn primary sm" type="submit" disabled={editBusy}>
                      {editBusy ? (
                        <>
                          <Loader2 size={14} className="hd-action-toast-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        'Save changes'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : null}
              </aside>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
