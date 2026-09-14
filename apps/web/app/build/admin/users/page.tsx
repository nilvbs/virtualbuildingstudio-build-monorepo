'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, Pencil, Search, ShieldAlert, Trash2, Users } from 'lucide-react';
import type { AdminUser, MembershipRole, UserStatus } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
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

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | MembershipRole>('all');
  const [status, setStatus] = useState<'all' | UserStatus>('all');
  const [canManage, setCanManage] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function onDelete(u: AdminUser) {
    if (!canManage) return;
    if (u.id === selfId) {
      setError('You cannot delete your own account.');
      return;
    }
    if (u.roles.includes('admin')) {
      setError('Staff accounts must be removed from Staff first.');
      return;
    }
    const ok = window.confirm(
      `Delete ${u.fullName}? This removes their account and related data. This cannot be undone.`,
    );
    if (!ok) return;
    setBusyId(u.id);
    setError(null);
    try {
      await api.deleteAdminUser(u.id);
      setUsers((prev) => (prev ? prev.filter((row) => row.id !== u.id) : prev));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-cli">
      {!forbidden && (
        <div className="admin-cli-bar">
          <div className="admin-cli-summary">
            <h2 className="admin-cli-heading">
              {loading && !users
                ? 'Loading users…'
                : `${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
            </h2>
            <p className="admin-cli-lede">
              View accounts, edit details, suspend access, or delete marketplace users.
            </p>
          </div>
          <div className="admin-cli-filters" style={{ flexWrap: 'wrap' }}>
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
              value={role}
              onChange={(e) => setRole(e.target.value as 'all' | MembershipRole)}
              aria-label="Filter by role"
              style={{ minWidth: 130 }}
            >
              <option value="all">All roles</option>
              <option value="client">Client</option>
              <option value="surveyor">Surveyor</option>
              <option value="admin">Admin</option>
            </select>
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
                              <span>@{u.username}</span>
                            </span>
                          </Link>
                        </td>
                        <td>{roleLabel(u.roles)}</td>
                        <td>
                          <a href={`mailto:${u.email}`} className="plain admin-users-contact">
                            {u.email}
                          </a>
                        </td>
                        <td>
                          <span className="admin-users-contact">{u.phone}</span>
                        </td>
                        <td>{u.city || '—'}</td>
                        <td>
                          <StatusBadge status={u.status} />
                        </td>
                        <td>
                          <time dateTime={u.createdAt}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </time>
                        </td>
                        <td>
                          <div className="admin-users-actions">
                            <Link
                              href={`/build/admin/users/${u.id}`}
                              className="admin-users-action"
                              title="View"
                              aria-label={`View ${u.fullName}`}
                            >
                              <Eye size={15} strokeWidth={2} />
                            </Link>
                            <Link
                              href={`/build/admin/users/${u.id}#edit`}
                              className="admin-users-action"
                              title="Edit"
                              aria-label={`Edit ${u.fullName}`}
                            >
                              <Pencil size={15} strokeWidth={2} />
                            </Link>
                            <button
                              type="button"
                              className="admin-users-action admin-users-action--danger"
                              title={
                                canDelete
                                  ? 'Delete'
                                  : u.roles.includes('admin')
                                    ? 'Remove staff access first'
                                    : 'Delete not allowed'
                              }
                              aria-label={`Delete ${u.fullName}`}
                              disabled={!canDelete || busyId === u.id}
                              onClick={() => void onDelete(u)}
                            >
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
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
