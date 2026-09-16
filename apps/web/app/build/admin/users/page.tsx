'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, Loader2, Pencil, Search, ShieldAlert, Trash2, Users, X } from 'lucide-react';
import type { AdminUser, MembershipRole, UserStatus } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { toastError, toastSuccess } from '../../../../lib/action-toast';
import { displayPhone } from '../../../../lib/country-codes';
import { StatusBadge } from '../../../../components/status';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function roleLabel(roles: MembershipRole[]) {
  if (roles.length === 0) return '—';
  return roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' · ');
}

function roleFromQuery(value: string | null): 'all' | MembershipRole {
  if (value === 'client' || value === 'surveyor' || value === 'admin') return value;
  return 'all';
}

function LoadingState() {
  return (
    <div className="hd-admin-table-wrap" aria-hidden>
      <table className="hd-admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Location</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((i) => (
            <tr key={i}>
              <td colSpan={8}>
                <div className="skeleton sk-line" style={{ width: '100%', height: 18 }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROLE_FILTERS: { id: 'all' | MembershipRole; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'client', label: 'Clients' },
  { id: 'surveyor', label: 'Surveyors' },
  { id: 'admin', label: 'Admin' },
];

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminUsersPageInner />
    </Suspense>
  );
}

function AdminUsersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | MembershipRole>(() =>
    roleFromQuery(searchParams.get('role')),
  );
  const [status, setStatus] = useState<'all' | UserStatus>('all');
  const [canManage, setCanManage] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setRole(roleFromQuery(searchParams.get('role')));
  }, [searchParams]);

  useEffect(() => {
    if (!pendingDelete) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && busyId == null) setPendingDelete(null);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [pendingDelete, busyId]);

  const setRoleFilter = useCallback(
    (next: 'all' | MembershipRole) => {
      setRole(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') params.delete('role');
      else params.set('role', next);
      const qs = params.toString();
      router.replace(qs ? `/build/admin/users?${qs}` : '/build/admin/users');
    },
    [router, searchParams],
  );

  const loadUsers = useCallback(() => {
    setLoading(true);
    return api
      .listAdminUsers({
        ...(role !== 'all' ? { role } : {}),
        ...(status !== 'all' ? { status } : {}),
      })
      .then(setUsers)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router, role, status]);

  useEffect(() => {
    void api
      .me()
      .then((me) => {
        setSelfId(me.id);
        setCanManage(
          me.staffLevel === 'super_admin' || Boolean(me.permissions?.includes('users:manage')),
        );
      })
      .catch(() => {
        /* list call still gates access */
      });
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      [u.fullName, u.email, u.phone, u.username, u.companyName ?? '', u.city ?? '', ...u.roles]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [users, q]);

  const headingLabel =
    role === 'client'
      ? 'client'
      : role === 'surveyor'
        ? 'surveyor'
        : role === 'admin'
          ? 'admin'
          : 'user';

  function requestDelete(u: AdminUser) {
    if (!canManage) return;
    if (u.id === selfId) {
      toastError('Cannot delete', 'You cannot delete your own account.');
      return;
    }
    if (u.roles.includes('admin')) {
      toastError('Cannot delete', 'Staff accounts must be removed from Staff first.');
      return;
    }
    setError(null);
    setPendingDelete(u);
  }

  async function confirmDelete() {
    const u = pendingDelete;
    if (!u || !canManage) return;
    setBusyId(u.id);
    setError(null);
    try {
      await api.deleteAdminUser(u.id);
      setUsers((prev) => (prev ? prev.filter((row) => row.id !== u.id) : prev));
      setPendingDelete(null);
      toastSuccess('User deleted', `${u.fullName} was removed.`);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toastError('Delete failed', message);
    } finally {
      setBusyId(null);
    }
  }

  const deleteModal =
    pendingDelete && mounted
      ? createPortal(
          <div className="sheet-modal" role="presentation">
            <button
              type="button"
              className="sheet-modal-backdrop"
              aria-label="Dismiss"
              disabled={busyId === pendingDelete.id}
              onClick={() => setPendingDelete(null)}
            />
            <div
              className="sheet-modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-delete-user-title"
            >
              <button
                type="button"
                className="sheet-modal-close"
                onClick={() => setPendingDelete(null)}
                disabled={busyId === pendingDelete.id}
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <p className="kicker" style={{ marginBottom: 6 }}>
                Delete account
              </p>
              <h2 id="admin-delete-user-title" className="sheet-modal-title">
                Delete {pendingDelete.fullName}?
              </h2>
              <p className="sheet-modal-copy">
                This removes their account and related data. This cannot be undone.
              </p>
              <div className="sheet-modal-actions">
                <button
                  type="button"
                  className="btn block"
                  disabled={busyId === pendingDelete.id}
                  onClick={() => void confirmDelete()}
                  style={{ background: 'var(--danger, #b42318)', borderColor: 'transparent' }}
                >
                  {busyId === pendingDelete.id ? (
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
                  disabled={busyId === pendingDelete.id}
                  onClick={() => setPendingDelete(null)}
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
    <div className="admin-cli">
      {deleteModal}
      {!forbidden && (
        <div className="admin-cli-bar">
          <div className="admin-cli-summary">
            <h2 className="admin-cli-heading">
              {loading && !users
                ? 'Loading users…'
                : `${filtered.length} ${headingLabel}${filtered.length === 1 ? '' : 's'}`}
            </h2>
            <p className="admin-cli-lede">
              Clients and surveyors in one list — filter by role, then view, edit, or delete.
            </p>
          </div>
          <div className="admin-cli-filters" style={{ flexWrap: 'wrap' }}>
            <div className="admin-users-role-pills" role="group" aria-label="Filter by role">
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`admin-users-role-pill${role === f.id ? ' is-on' : ''}`}
                  aria-pressed={role === f.id}
                  onClick={() => setRoleFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="admin-cli-search">
              <Search size={15} strokeWidth={2} aria-hidden />
              <input
                type="search"
                placeholder="Search users"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search users"
              />
            </label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | UserStatus)}
              aria-label="Filter by status"
              style={{ minWidth: 130 }}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            {q.trim() ? (
              <button type="button" className="btn secondary admin-cli-clear" onClick={() => setQ('')}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      )}

      {forbidden && (
        <div className="empty">
          <div className="empty-ico">
            <ShieldAlert size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>No access to users</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Ask your super admin to grant the “View users” permission.
          </p>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
      {loading && !forbidden && <LoadingState />}

      {users && !forbidden && (
        <>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">
                <Users size={24} />
              </div>
              <h3 style={{ fontSize: 17 }}>{q ? 'No matches' : 'No users yet'}</h3>
            </div>
          ) : (
            <div className="hd-admin-table-wrap">
              <table className="hd-admin-table admin-users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const canDelete =
                      canManage && u.id !== selfId && !u.roles.includes('admin');
                    return (
                      <tr key={u.id}>
                        <td>
                          <Link
                            href={`/build/admin/users/${u.id}`}
                            className="admin-users-person plain"
                          >
                            <span className="admin-users-avatar" aria-hidden>
                              {initials(u.fullName)}
                            </span>
                            <span className="admin-users-person-text">
                              <strong>{u.fullName}</strong>
                              {u.companyName ? <small>{u.companyName}</small> : null}
                            </span>
                          </Link>
                        </td>
                        <td>{roleLabel(u.roles)}</td>
                        <td>
                          <span className="admin-users-mono">{u.email}</span>
                        </td>
                        <td>
                          <span className="admin-users-mono">{displayPhone(u.phone)}</span>
                        </td>
                        <td>{u.city ?? '—'}</td>
                        <td>
                          <StatusBadge status={u.status} />
                        </td>
                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-users-actions">
                            <Link
                              href={`/build/admin/users/${u.id}`}
                              className="btn secondary sm"
                              title="View"
                            >
                              <Eye size={14} />
                            </Link>
                            <Link
                              href={`/build/admin/users/${u.id}#edit`}
                              className="btn secondary sm"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </Link>
                            {canDelete ? (
                              <button
                                type="button"
                                className="btn secondary sm"
                                title="Delete"
                                disabled={busyId === u.id}
                                onClick={() => requestDelete(u)}
                                style={{ color: 'var(--danger, #b42318)' }}
                              >
                                {busyId === u.id ? (
                                  <Loader2 size={14} className="hd-action-toast-spin" aria-hidden />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
