'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Shield } from 'lucide-react';

export default function AdminRegisterPage() {
  return (
    <main className="staff-shell">
      <aside className="staff-aside" aria-hidden>
        <div className="staff-aside-inner">
          <Image
            src="/brand/bld-logo-dark.png"
            alt=""
            width={636}
            height={236}
            className="staff-aside-logo"
            priority
          />
          <p className="staff-aside-kicker">
            <Shield size={13} strokeWidth={2.4} />
            Staff portal
          </p>
          <h2 className="staff-aside-title">Invite only</h2>
          <p className="staff-aside-copy">
            New admin accounts are created by the super admin from Operations → Staff. Public
            self-registration is disabled.
          </p>
        </div>
      </aside>

      <section className="staff-main">
        <div className="staff-card">
          <div className="staff-card-brand staff-card-brand--mobile">
            <Image
              src="/brand/bld-logo-dark.png"
              alt="BLD"
              width={636}
              height={236}
              className="staff-logo"
              priority
            />
          </div>
          <p className="staff-kicker">
            <Shield size={13} strokeWidth={2.4} />
            Staff portal
          </p>
          <h1 className="staff-title">Invite only</h1>
          <p className="staff-lede">
            New admin accounts are created by the super admin from Operations → Staff. Public
            self-registration is disabled.
          </p>
          <Link className="btn block" href="/build/admin">
            Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
