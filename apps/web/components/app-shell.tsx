'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  Handshake,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Shield,
  UserRound,
} from 'lucide-react';
import type { AuthenticatedUser, WorkspaceRole, StaffPermission } from '@surveylink/types';
import { api, ApiError } from '../lib/api';
import { homePathForWorkspace, workspaceMemberships } from '../lib/home';
import { clearSession, isAuthenticated, setActiveRole } from '../lib/session';
import { IncompleteProfileModal, SidebarProfileMeter } from './profile-completion';

type Section = 'client' | 'surveyor' | 'admin';

const SECTION_HOME: Record<Section, string> = {
  client: '/client',
  surveyor: '/surveyor',
  admin: '/build/admin/queue',
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Surveyor: hide until profile is 100% complete. */
  requiresCompleteProfile?: boolean;
  requiresPermission?: StaffPermission;
}

const NAV: Record<Section, { label: string; sub: string; sectionLabel?: string; items: NavItem[] }> = {
  client: {
    label: 'Your projects',
    sub: 'Post and track your survey projects',
    items: [{ href: '/client', label: 'Projects', icon: LayoutDashboard }],
  },
  surveyor: {
    label: 'Surveyor workspace',
    sub: 'Dashboard, profile, and matches',
    items: [
      { href: '/surveyor', label: 'Dashboard', icon: LayoutDashboard, exact: true, requiresCompleteProfile: true },
      { href: '/surveyor/profile', label: 'Profile', icon: UserRound },
      { href: '/surveyor/matches', label: 'My Matches', icon: Handshake },
    ],
  },
  admin: {
    label: 'Operations',
    sub: 'Match projects to surveyors',
    items: [
      { href: '/build/admin/queue', label: 'Match queue', icon: LayoutDashboard, exact: true },
      {
        href: '/build/admin/staff',
        label: 'Staff',
        icon: Shield,
        requiresPermission: 'staff:manage',
      },
    ],
  },
};

const SURVEYOR_SNOOZE_KEY = 'bld.surveyor.profilePromptSnoozed';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

function topbarCopy(section: Section, pathname: string): { label: string; sub: string } {
  if (section === 'client') {
    if (pathname.startsWith('/client/projects/new')) {
      return { label: 'Post a project', sub: 'Brief, site, and timing' };
    }
    if (/^\/client\/projects\/[^/]+/.test(pathname)) {
      return { label: 'Project details', sub: 'Status, progress, and brief' };
    }
    return { label: 'Your projects', sub: 'Post and track survey work' };
  }
  if (section === 'surveyor') {
    if (pathname.startsWith('/surveyor/profile')) {
      return { label: 'Profile', sub: 'Services, coverage, and rates' };
    }
    if (pathname.startsWith('/surveyor/matches')) {
      return { label: 'My Matches', sub: 'Projects matched to you' };
    }
    return { label: 'Dashboard', sub: 'Live matching status' };
  }
  return { label: NAV[section].label, sub: NAV[section].sub };
}

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === '/client') return pathname === '/client' || pathname.startsWith('/client/');
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ section, children }: { section: Section; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [completionPercent, setCompletionPercent] = useState<number | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(section === 'admin' ? '/build/admin' : '/login');
      return;
    }
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace(section === 'admin' ? '/build/admin' : '/login');
        }
      });
  }, [router, section]);

  useEffect(() => {
    if (section !== 'surveyor' || !isAuthenticated()) return;
    let cancelled = false;

    function refreshStatus() {
      api
        .getSurveyorStatus()
        .then((status) => {
          if (cancelled) return;
          setCompletionPercent(status.completionPercent);
          setProfileComplete(status.profileComplete);
          const snoozed =
            typeof window !== 'undefined' && sessionStorage.getItem(SURVEYOR_SNOOZE_KEY) === '1';
          const forcePrompt =
            typeof window !== 'undefined' &&
            window.location.pathname.startsWith('/surveyor/profile') &&
            new URLSearchParams(window.location.search).get('complete') === '1';
          setShowProfilePrompt(!status.profileComplete && (forcePrompt || !snoozed));
        })
        .catch(() => {
          /* leave completion null; nav still shows Profile + Matches */
        });
    }

    refreshStatus();
    function onProfileSaved() {
      refreshStatus();
    }
    window.addEventListener('bld:surveyor-profile-saved', onProfileSaved);
    return () => {
      cancelled = true;
      window.removeEventListener('bld:surveyor-profile-saved', onProfileSaved);
    };
  }, [section, pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  function signOut() {
    setMenuOpen(false);
    clearSession();
    if (typeof window !== 'undefined') sessionStorage.removeItem(SURVEYOR_SNOOZE_KEY);
    window.location.assign(section === 'admin' ? '/build/admin' : '/?auth=login');
  }

  function switchWorkspace(role: WorkspaceRole) {
    setActiveRole(role);
    setMenuOpen(false);
    router.push(homePathForWorkspace(role));
  }

  async function addWorkspace(role: WorkspaceRole) {
    try {
      const updated = await api.addMembership({ role });
      setUser(updated);
      switchWorkspace(role);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace('/login');
      }
    }
  }

  function snoozeProfilePrompt() {
    if (typeof window !== 'undefined') sessionStorage.setItem(SURVEYOR_SNOOZE_KEY, '1');
    setShowProfilePrompt(false);
    if (pathname === '/surveyor') {
      router.replace('/surveyor/profile');
    } else if (pathname.startsWith('/surveyor/profile')) {
      router.replace('/surveyor/profile');
    }
  }

  const nav = NAV[section];
  const header = topbarCopy(section, pathname);
  const workspaces = user ? workspaceMemberships(user) : [];
  const roleLabel =
    user?.roles.includes('admin') && section === 'admin'
      ? user.staffLevel === 'super_admin'
        ? 'Super admin'
        : 'Administrator'
      : section === 'client'
        ? 'Client'
        : section === 'surveyor'
          ? 'Expert (surveyor)'
          : user
            ? user.roleHint.charAt(0).toUpperCase() + user.roleHint.slice(1)
            : '';

  const navItems = nav.items.filter((item) => {
    if (item.requiresCompleteProfile && !profileComplete) return false;
    if (item.requiresPermission) {
      return Boolean(user?.permissions?.includes(item.requiresPermission));
    }
    return true;
  });

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link
            href={section === 'surveyor' && !profileComplete ? '/surveyor/profile' : SECTION_HOME[section]}
            className="brand plain"
            aria-label="BLD home"
          >
            <Image
              src="/brand/bld-logo-dark.png"
              alt="BLD"
              width={636}
              height={236}
              className="brand-logo"
              priority
            />
          </Link>

          {nav.sectionLabel ? <div className="nav-section">{nav.sectionLabel}</div> : null}
          <nav className={`nav${nav.sectionLabel ? '' : ' nav--flush'}`}>
            {navItems.map((item) => {
              const active = isNavActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item plain ${active ? 'active' : ''}`}
                >
                  <Icon size={18} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {section === 'surveyor' && completionPercent != null && (
            <div className="sidebar-completion">
              <SidebarProfileMeter percent={completionPercent} complete={profileComplete} />
            </div>
          )}
        </div>

        <div className="sidebar-foot">
          <span className="sidebar-foot-mark" aria-hidden>
            B
          </span>
          <span>Phase 1</span>
        </div>
      </aside>

      <div className="shell-body">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="topbar-title">{header.label}</div>
            <div className="topbar-sub">{header.sub}</div>
          </div>

          <div className="usermenu" ref={menuRef}>
            <button className="usermenu-trigger" type="button" onClick={() => setMenuOpen((o) => !o)}>
              <span className="avatar">{user ? initials(user.fullName) : '·'}</span>
              <span className="usermenu-text">
                <span className="usermenu-name">{user?.fullName ?? 'Loading…'}</span>
                <span className="usermenu-role">{roleLabel}</span>
              </span>
              <ChevronDown size={15} className="usermenu-caret" />
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                {section !== 'admin' && workspaces.includes('client') && section !== 'client' && (
                  <button className="menu-item" type="button" role="menuitem" onClick={() => switchWorkspace('client')}>
                    Switch to client
                  </button>
                )}
                {section !== 'admin' && workspaces.includes('surveyor') && section !== 'surveyor' && (
                  <button className="menu-item" type="button" role="menuitem" onClick={() => switchWorkspace('surveyor')}>
                    Switch to expert (surveyor)
                  </button>
                )}
                {section !== 'admin' && !workspaces.includes('client') && (
                  <button className="menu-item" type="button" role="menuitem" onClick={() => addWorkspace('client')}>
                    Add client workspace
                  </button>
                )}
                {section !== 'admin' && !workspaces.includes('surveyor') && (
                  <button className="menu-item" type="button" role="menuitem" onClick={() => addWorkspace('surveyor')}>
                    Add expert (surveyor) workspace
                  </button>
                )}
                <button
                  className="menu-item danger"
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    signOut();
                  }}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <div
          className={`shell-content${section === 'client' || section === 'surveyor' ? ' shell-content--wide' : ''}`}
        >
          {children}
        </div>
      </div>

      {section === 'surveyor' && completionPercent != null && (
        <IncompleteProfileModal
          open={showProfilePrompt && !profileComplete}
          percent={completionPercent}
          onClose={snoozeProfilePrompt}
          onGoToProfile={() => {
            setShowProfilePrompt(false);
            router.push('/surveyor/profile');
          }}
        />
      )}
    </div>
  );
}
