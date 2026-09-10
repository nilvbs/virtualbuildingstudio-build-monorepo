'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { HelpTicketWorkspace } from '@surveylink/types';
import { faqsForWorkspace } from '../lib/help-faqs';

export function HelpFaqSection({ workspace }: { workspace: HelpTicketWorkspace }) {
  const baseId = useId();
  const faqs = faqsForWorkspace(workspace);
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <section className="hd-faq" aria-labelledby={`${baseId}-title`}>
      <div className="hd-faq-head">
        <h2 id={`${baseId}-title`}>Frequently asked questions</h2>
        <p>
          {workspace === 'client'
            ? 'Quick answers about briefs, matching, and your projects.'
            : 'Quick answers about portfolio, requests, and matches.'}
        </p>
      </div>
      <div className="hd-faq-list">
        {faqs.map((item) => {
          const open = openId === item.id;
          const panelId = `${baseId}-${item.id}-panel`;
          const buttonId = `${baseId}-${item.id}-btn`;
          return (
            <div key={item.id} className={`hd-faq-item${open ? ' is-open' : ''}`}>
              <button
                type="button"
                id={buttonId}
                className="hd-faq-q"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <span>{item.question}</span>
                <ChevronDown size={18} strokeWidth={2.2} aria-hidden />
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="hd-faq-a"
                hidden={!open}
              >
                <p>{item.answer}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
