export default function NdaPage() {
  return (
    <main className="auth-shell">
      <article className="auth-card" style={{ maxWidth: 720 }}>
        <div className="auth-panel">
          <p className="kicker" style={{ marginBottom: 4 }}>
            Legal
          </p>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Non-Disclosure Agreement</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            You agree to keep confidential any non-public project details, site information, drawings,
            pricing, and personal data shared through the platform, and to use that information only
            to evaluate or deliver survey work. You must not disclose confidential information to
            third parties without written permission, except where required by law.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            For production use, replace this placeholder with your counsel-approved NDA.
          </p>
        </div>
      </article>
    </main>
  );
}
