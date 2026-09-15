'use client';

import { Check, Circle } from 'lucide-react';

export type PasswordRule = {
  id: string;
  label: string;
  /** Compact label for the one-line checklist. */
  shortLabel: string;
  test: (password: string) => boolean;
};

/** Aligns with Auth0’s usual “good” DB policy so Create account doesn’t hit “Validation failed”. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    shortLabel: '8+',
    test: (p) => p.length >= 8,
  },
  {
    id: 'lower',
    label: 'One lowercase letter',
    shortLabel: 'a–z',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'upper',
    label: 'One uppercase letter',
    shortLabel: 'A–Z',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'number',
    label: 'One number',
    shortLabel: '0–9',
    test: (p) => /\d/.test(p),
  },
  {
    id: 'special',
    label: 'One symbol (!@#$…)',
    shortLabel: 'symbol',
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export function passwordMeetsPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function passwordStrengthScore(password: string): number {
  if (!password) return 0;
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}

type Props = {
  password: string;
  /** Hide the checklist until the user starts typing. */
  showWhenEmpty?: boolean;
};

/**
 * Live password checklist for Create account — updates as the user types.
 * Kept to ~2 lines: meter + strength, then a compact rule row.
 */
export function PasswordStrength({ password, showWhenEmpty = false }: Props) {
  if (!password && !showWhenEmpty) return null;

  const score = passwordStrengthScore(password);
  const label =
    score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong';
  const tone =
    score <= 1 ? 'weak' : score <= 3 ? 'fair' : score === 4 ? 'good' : 'strong';

  return (
    <div className={`pwd-strength pwd-strength--${tone}`} aria-live="polite">
      <div className="pwd-strength-top">
        <div className="pwd-strength-meter" aria-hidden>
          {PASSWORD_RULES.map((rule, i) => (
            <span
              key={rule.id}
              className={`pwd-strength-seg${i < score ? ' is-on' : ''}`}
            />
          ))}
        </div>
        <p className="pwd-strength-label">
          Strength: <strong>{password ? label : '—'}</strong>
        </p>
      </div>
      <ul className="pwd-strength-list" aria-label="Password requirements">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={ok ? 'is-ok' : 'is-miss'} title={rule.label}>
              {ok ? (
                <Check size={12} strokeWidth={2.5} aria-hidden />
              ) : (
                <Circle size={12} strokeWidth={2} aria-hidden />
              )}
              <span>{rule.shortLabel}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
