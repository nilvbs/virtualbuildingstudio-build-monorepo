export default function TermsPage() {
  return (
    <main className="auth-shell">
      <article className="auth-card" style={{ maxWidth: 720 }}>
        <div className="auth-panel">
          <p className="kicker" style={{ marginBottom: 4 }}>
            Legal
          </p>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Terms & Conditions</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            By creating an account and using SurveyLink / BLD, you agree to use the platform
            lawfully, keep your login credentials secure, and provide accurate account information.
            Marketplace matching, project submissions, and messaging are subject to the platform&apos;s
            operating policies. We may update these terms; continued use after notice constitutes
            acceptance of the revised terms.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            For production use, replace this placeholder with your counsel-approved Terms &amp;
            Conditions.
          </p>
        </div>
      </article>
    </main>
  );
}
