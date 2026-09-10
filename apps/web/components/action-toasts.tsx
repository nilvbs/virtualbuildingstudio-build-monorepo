'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import {
  dismissActionToast,
  subscribeActionToasts,
  type ActionToast,
} from '../lib/action-toast';

function ToastIcon({ kind }: { kind: ActionToast['kind'] }) {
  if (kind === 'loading') return <Loader2 size={16} className="hd-action-toast-spin" aria-hidden />;
  if (kind === 'success') return <CheckCircle2 size={16} aria-hidden />;
  return <XCircle size={16} aria-hidden />;
}

export function ActionToasts() {
  const [items, setItems] = useState<ActionToast[]>([]);

  useEffect(() => subscribeActionToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="hd-action-toast-stack" aria-live="polite" aria-relevant="additions text">
      {items.map((t) => (
        <article
          key={t.id}
          className={`hd-action-toast hd-action-toast--${t.kind}`}
          role={t.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="hd-action-toast-ico">
            <ToastIcon kind={t.kind} />
          </span>
          <div className="hd-action-toast-copy">
            <strong>{t.title}</strong>
            {t.body ? <span>{t.body}</span> : null}
          </div>
          {t.kind !== 'loading' ? (
            <button
              type="button"
              className="hd-action-toast-close"
              aria-label="Dismiss"
              onClick={() => dismissActionToast(t.id)}
            >
              <X size={14} />
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
