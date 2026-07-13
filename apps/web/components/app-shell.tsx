'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  PlusCircle,
  Radar,
  UserRound,
} from 'lucide-react';
import type { AuthenticatedUser, WorkspaceRole } from '@surveylink/types';
import { api, ApiError } from '../lib/api';
import { homePathForWorkspace, workspaceMemberships } from '../lib/home';
import { clearSession, isAuthenticated, setActiveRole } from '../lib/session';

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
}

const NAV: Record<Section, { label: string; sub: string; items: NavItem[] }> = {
  client: {
    label: 'Client workspace',
    sub: 'Post and track your survey projects',
    items: [
      { href: '/client', label: 'Projects', icon: LayoutDashboard, exact: true },
      { href: '/client/projects/new', label: 'Post a project', icon: PlusCircle },
    ],
  },
  surveyor: {
    label: 'Surveyor workspace',
    sub: 'Your matches and profile',
    items: [
      { href: '/surveyor', label: 'Status', icon: Radar, exact: true },
      { href: '/surveyor/profile', label: 'Profile', icon: UserRound },
    ],
  },
  admin: {
    label: 'Operations',
    sub: 'Match projects to surveyors',
    items: [{ href: '/build/admin/queue', label: 'Match queue', icon: LayoutDashboard, exact: true }],
  },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export function AppShell({ section, children }: { section: Section; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function signOut() {
    clearSession();
    router.replace(section === 'admin' ? '/build/admin' : '/login');
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

  const nav = NAV[section];
  const workspaces = user ? workspaceMemberships(user) : [];
  const roleLabel = user?.roles.includes('admin') && section === 'admin'
    ? 'Administrator'
    : section === 'client'
      ? 'Client workspace'
      : section === 'surveyor'
        ? 'Expert (surveyor)'
        : user
          ? user.roleHint.charAt(0).toUpperCase() + user.roleHint.slice(1)
          : '';

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={SECTION_HOME[section]} className="brand plain" aria-label="BLD home">
          <Image
            src="/brand/bld-logo-dark.png"
            alt="BLD"
            width={636}
            height={236}
            className="brand-logo"
            priority
          />
        </Link>

        <div className="nav-section">{nav.label}</div>
        <nav className="nav">
          {nav.items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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

        <div className="sidebar-foot">BLD · Phase 1</div>
      </aside>

      <div className="shell-body">
        <header className="topbar">
          <div>
            <div className="topbar-title">{nav.label}</div>
            <div className="topbar-sub">{nav.sub}</div>
          </div>

          <div className="usermenu" ref={menuRef}>
            <button className="usermenu-trigger" onClick={() => setMenuOpen((o) => !o)}>
              <span className="avatar">{user ? initials(user.fullName) : '·'}</span>
              <span style={{ textAlign: 'left' }}>
                <span className="usermenu-name" style={{ display: 'block' }}>
                  {user?.fullName ?? 'Loading…'}
                </span>
                <span className="usermenu-role">{roleLabel}</span>
              </span>
              <ChevronDown size={15} style={{ color: 'var(--muted)' }} />
            </button>
            {menuOpen && (
              <div className="menu">
                {section !== 'admin' && workspaces.includes('client') && section !== 'client' && (
                  <button className="menu-item" type="button" onClick={() => switchWorkspace('client')}>
                    Switch to client
                  </button>
                )}
                {section !== 'admin' && workspaces.includes('surveyor') && section !== 'surveyor' && (
                  <button className="menu-item" type="button" onClick={() => switchWorkspace('surveyor')}>
                    Switch to expert (surveyor)
                  </button>
                )}
                {section !== 'admin' && !workspaces.includes('client') && (
                  <button className="menu-item" type="button" onClick={() => addWorkspace('client')}>
                    Add client workspace
                  </button>
                )}
                {section !== 'admin' && !workspaces.includes('surveyor') && (
                  <button className="menu-item" type="button" onClick={() => addWorkspace('surveyor')}>
                    Add expert (surveyor) workspace
                  </button>
                )}
                <button className="menu-item danger" onClick={signOut}>
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="shell-content">{children}</div>
      </div>
    </div>
  );
}
