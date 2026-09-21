'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  Pencil,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AdminUser, MembershipRole, UserStatus } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { toastError, toastSuccess } from '../../../../lib/action-toast';
import { displayPhone } from '../../../../lib/country-codes';
import { StatusBadge } from '../../../../components/status';

type SortBy = 'fullName' | 'email' | 'phone' | 'city' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

const ROLE_FILTERS: { id: 'all' | MembershipRole; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'client', label: 'Clients' },
  { id: 'surveyor', label: 'Surveyors' },
  { id: 'admin', label: 'Admin' },
];

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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown size={13} aria-hidden />;
  return dir === 'asc' ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />;
}

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
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [role, setRole] = useState<'all' | MembershipRole>(() =>
    roleFromQuery(searchParams.get('role')),
  );
  const [status, setStatus] = useState<'all' | UserStatus>('all');
  const [city, setCity] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [canManage, setCanManage] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [openFilter, setOpenFilter] = useState<'role' | 'status' | 'city' | null>(null);
  const filterRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setRole(roleFromQuery(searchParams.get('role')));
  }, [searchParams]);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, role, status, city, sortBy, sortDir]);

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

  useEffect(() => {
    if (!openFilter) return;
    function onDoc(e: MouseEvent) {
      if (!filterRef.current?.contains(e.target as Node)) setOpenFilter(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openFilter]);

  const setRoleFilter = useCallback(
    (next: 'all' | MembershipRole) => {
      setRole(next);
      setPage(1);
      setOpenFilter(null);
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
        ...(qDebounced ? { q: qDebounced } : {}),
        ...(role !== 'all' ? { role } : {}),
        ...(status !== 'all' ? { status } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        setUsers(res.items);
        setTotal(res.total);
        setForbidden(false);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/build/admin');
        else if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router, qDebounced, role, status, city, sortBy, sortDir, page]);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(1);
  }

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
      setPendingDelete(null);
      toastSuccess('User deleted', `${u.fullName} was removed.`);
      await loadUsers();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
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

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="admin-cli">
      {deleteModal}
      {!forbidden && (
        <div className="admin-cli-bar admin-cli-bar--users">
          <div className="admin-cli-filters admin-cli-filters--inline admin-cli-filters--start" role="toolbar" aria-label="User filters">
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
            <div className="admin-cli-tools">
              <label className="admin-cli-search admin-cli-search--compact">
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
                className="admin-cli-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as 'all' | UserStatus);
                  setPage(1);
                }}
                aria-label="Filter by status"
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              {q.trim() || city.trim() ? (
                <button
                  type="button"
                  className="btn secondary admin-cli-clear"
                  onClick={() => {
                    setQ('');
                    setCity('');
                    setCityDraft('');
                    setPage(1);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
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
      {loading && !forbidden && !users && <LoadingState />}

      {users && !forbidden && (
        <>
          {users.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">
                <Users size={24} />
              </div>
              <h3 style={{ fontSize: 17 }}>
                {qDebounced || city || status !== 'all' || role !== 'all'
                  ? 'No matches'
                  : 'No users yet'}
              </h3>
            </div>
          ) : (
            <>
              <div className="hd-admin-table-wrap">
                <table className="hd-admin-table admin-users-table">
                  <thead ref={filterRef}>
                    <tr>
                      <th>
                        <button
                          type="button"
                          className={`admin-th-btn${sortBy === 'fullName' ? ' is-active' : ''}`}
                          onClick={() => toggleSort('fullName')}
                        >
                          User
                          <SortIcon active={sortBy === 'fullName'} dir={sortDir} />
                        </button>
                      </th>
                      <th className="admin-th-filter">
                        <button
                          type="button"
                          className={`admin-th-btn${role !== 'all' ? ' is-active' : ''}`}
                          aria-expanded={openFilter === 'role'}
                          onClick={() => setOpenFilter((v) => (v === 'role' ? null : 'role'))}
                        >
                          Role
                          <Filter size={13} aria-hidden />
                        </button>
                        {openFilter === 'role' ? (
                          <div className="admin-th-menu" role="menu">
                            {ROLE_FILTERS.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={role === f.id}
                                className={role === f.id ? 'is-on' : undefined}
                                onClick={() => setRoleFilter(f.id)}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`admin-th-btn${sortBy === 'email' ? ' is-active' : ''}`}
                          onClick={() => toggleSort('email')}
                        >
                          Email
                          <SortIcon active={sortBy === 'email'} dir={sortDir} />
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`admin-th-btn${sortBy === 'phone' ? ' is-active' : ''}`}
                          onClick={() => toggleSort('phone')}
                        >
                          Phone
                          <SortIcon active={sortBy === 'phone'} dir={sortDir} />
                        </button>
                      </th>
                      <th className="admin-th-filter">
                        <div className="admin-th-split">
                          <button
                            type="button"
                            className={`admin-th-btn${sortBy === 'city' ? ' is-active' : ''}`}
                            onClick={() => toggleSort('city')}
                          >
                            Location
                            <SortIcon active={sortBy === 'city'} dir={sortDir} />
                          </button>
                          <button
                            type="button"
                            className={`admin-th-icon${city ? ' is-active' : ''}`}
                            aria-label="Filter by location"
                            aria-expanded={openFilter === 'city'}
                            onClick={() => {
                              setCityDraft(city);
                              setOpenFilter((v) => (v === 'city' ? null : 'city'));
                            }}
                          >
                            <Filter size={13} aria-hidden />
                          </button>
                        </div>
                        {openFilter === 'city' ? (
                          <div className="admin-th-menu admin-th-menu--form" role="dialog">
                            <label>
                              <span>City</span>
                              <input
                                className="admin-th-input"
                                value={cityDraft}
                                onChange={(e) => setCityDraft(e.target.value)}
                                placeholder="Filter city"
                                autoFocus
                              />
                            </label>
                            <div className="admin-th-menu-actions">
                              <button
                                type="button"
                                className="btn secondary sm"
                                onClick={() => {
                                  setCity('');
                                  setCityDraft('');
                                  setOpenFilter(null);
                                  setPage(1);
                                }}
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                className="btn primary sm"
                                onClick={() => {
                                  setCity(cityDraft.trim());
                                  setOpenFilter(null);
                                  setPage(1);
                                }}
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </th>
                      <th className="admin-th-filter">
                        <div className="admin-th-split">
                          <button
                            type="button"
                            className={`admin-th-btn${sortBy === 'status' ? ' is-active' : ''}`}
                            onClick={() => toggleSort('status')}
                          >
                            Status
                            <SortIcon active={sortBy === 'status'} dir={sortDir} />
                          </button>
                          <button
                            type="button"
                            className={`admin-th-icon${status !== 'all' ? ' is-active' : ''}`}
                            aria-label="Filter by status"
                            aria-expanded={openFilter === 'status'}
                            onClick={() => setOpenFilter((v) => (v === 'status' ? null : 'status'))}
                          >
                            <Filter size={13} aria-hidden />
                          </button>
                        </div>
                        {openFilter === 'status' ? (
                          <div className="admin-th-menu" role="menu">
                            {(
                              [
                                { id: 'all', label: 'All status' },
                                { id: 'active', label: 'Active' },
                                { id: 'suspended', label: 'Suspended' },
                              ] as const
                            ).map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={status === f.id}
                                className={status === f.id ? 'is-on' : undefined}
                                onClick={() => {
                                  setStatus(f.id);
                                  setOpenFilter(null);
                                  setPage(1);
                                }}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`admin-th-btn${sortBy === 'createdAt' ? ' is-active' : ''}`}
                          onClick={() => toggleSort('createdAt')}
                        >
                          Joined
                          <SortIcon active={sortBy === 'createdAt'} dir={sortDir} />
                        </button>
                      </th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
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

              <div className="admin-users-pager" role="navigation" aria-label="Users pagination">
                <p className="admin-users-pager-meta">
                  Showing {from}–{to} of {total}
                </p>
                <div className="admin-users-pager-controls">
                  <button
                    type="button"
                    className="btn secondary sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} aria-hidden />
                    Prev
                  </button>
                  <span className="admin-users-pager-page">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn secondary sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={15} aria-hidden />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
