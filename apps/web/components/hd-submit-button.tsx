'use client';

type Variant = 'feedback' | 'ticket';

type Props = {
  busy?: boolean;
  disabled?: boolean;
  idleLabel: string;
  busyLabel?: string;
  className?: string;
  type?: 'submit' | 'button';
  onClick?: () => void;
  /** Distinct creative loading animation per form. */
  variant?: Variant;
};

export function HdSubmitButton({
  busy = false,
  disabled = false,
  idleLabel,
  busyLabel,
  className = '',
  type = 'submit',
  onClick,
  variant = 'ticket',
}: Props) {
  const loadingLabel =
    busyLabel ?? (variant === 'feedback' ? 'Sharing' : 'Launching');

  return (
    <button
      type={type}
      className={[
        'btn primary hd-submit-btn',
        `hd-submit-btn--${variant}`,
        busy ? 'is-loading' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || busy}
      onClick={onClick}
      aria-busy={busy || undefined}
    >
      <span className="hd-submit-shine" aria-hidden />

      {variant === 'feedback' && busy ? (
        <span className="hd-submit-fx hd-submit-fx--feedback" aria-hidden>
          <span className="hd-fb-orbit">
            <i>😊</i>
            <i>⭐</i>
            <i>💜</i>
            <i>✨</i>
          </span>
          <span className="hd-fb-heart">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 21s-6.7-4.35-9.33-7.4C.8 11.4.9 8.2 3.1 6.4c2-1.7 4.9-1.2 6.4.7L12 9l2.5-1.9c1.5-1.9 4.4-2.4 6.4-.7 2.2 1.8 2.3 5 .4 7.2C18.7 16.65 12 21 12 21z" />
            </svg>
          </span>
          <span className="hd-fb-burst">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>
      ) : null}

      {variant === 'ticket' && busy ? (
        <span className="hd-submit-fx hd-submit-fx--ticket" aria-hidden>
          <span className="hd-tk-plane">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </span>
          <span className="hd-tk-trail">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="hd-tk-stamp">
            <em>SEND</em>
          </span>
          <span className="hd-tk-scan" />
        </span>
      ) : null}

      {busy ? (
        <span className="hd-submit-label">
          {loadingLabel.replace(/…$/, '')}
          <span className="hd-submit-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </span>
      ) : (
        <span className="hd-submit-label">{idleLabel}</span>
      )}
    </button>
  );
}
