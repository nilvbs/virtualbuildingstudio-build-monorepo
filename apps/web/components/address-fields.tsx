'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  lookupPostalAddress,
  suggestAddresses,
  type AddressSuggestion,
} from '../lib/geocode';
import { LordIcon } from './lord-icon';

export type AddressFormValue = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type Props = {
  value: AddressFormValue;
  onChange: (next: AddressFormValue | ((prev: AddressFormValue) => AddressFormValue)) => void;
  /** onboarding uses Lord location icon + existing CSS grid */
  variant?: 'onboarding' | 'plain';
  line1Label?: string;
  disabled?: boolean;
  required?: boolean;
  idPrefix?: string;
};

export function AddressFields({
  value,
  onChange,
  variant = 'onboarding',
  line1Label = 'Base address',
  disabled = false,
  required = true,
  idPrefix = 'addr',
}: Props) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [postalHint, setPostalHint] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const suggestAbort = useRef<AbortController | null>(null);
  const postalAbort = useRef<AbortController | null>(null);
  /** Skip postal lookup right after picking a suggestion (already filled). */
  const skipPostalRef = useRef(false);

  function patch(partial: Partial<AddressFormValue>) {
    onChange((prev) => ({ ...prev, ...partial }));
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Address line autocomplete
  useEffect(() => {
    if (disabled) return;
    const q = value.line1.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearching(false);
      suggestAbort.current?.abort();
      return;
    }

    const timer = window.setTimeout(async () => {
      suggestAbort.current?.abort();
      const ctrl = new AbortController();
      suggestAbort.current = ctrl;
      setSearching(true);
      try {
        const hits = await suggestAddresses(q, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setSuggestions(hits);
          setOpen(hits.length > 0);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSuggestions([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [value.line1, disabled]);

  // Postal → city / state / country
  useEffect(() => {
    if (disabled) return;
    if (skipPostalRef.current) {
      skipPostalRef.current = false;
      return;
    }
    const postal = value.postalCode.trim();
    if (postal.length < 4) {
      setPostalHint(null);
      postalAbort.current?.abort();
      return;
    }

    const timer = window.setTimeout(async () => {
      postalAbort.current?.abort();
      const ctrl = new AbortController();
      postalAbort.current = ctrl;
      setPostalHint('Looking up…');
      try {
        const hit = await lookupPostalAddress(postal, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (!hit) {
          setPostalHint(null);
          return;
        }
        onChange((prev) => ({
          ...prev,
          city: hit.city || prev.city,
          state: hit.state || prev.state,
          country: hit.country || prev.country,
          postalCode: hit.postalCode || prev.postalCode,
        }));
        setPostalHint(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setPostalHint(null);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [value.postalCode, disabled, onChange]);

  function selectSuggestion(hit: AddressSuggestion) {
    skipPostalRef.current = true;
    onChange((prev) => ({
      ...prev,
      line1: hit.line1 || prev.line1,
      city: hit.city || prev.city,
      state: hit.state || prev.state,
      postalCode: hit.postalCode || prev.postalCode,
      country: hit.country || prev.country,
    }));
    setSuggestions([]);
    setOpen(false);
  }

  const inputClass = variant === 'onboarding' ? 'input onboarding-input' : undefined;

  return (
    <div className={`addr-fields${variant === 'onboarding' ? ' addr-fields--onboarding' : ''}`}>
      <div className="field addr-line1-field" ref={wrapRef}>
        <label htmlFor={`${idPrefix}-line1`}>{line1Label}</label>
        {variant === 'onboarding' ? (
          <div className="input-icon">
            <LordIcon name="location" size={18} trigger="hover" />
            <input
              id={`${idPrefix}-line1`}
              type="text"
              value={value.line1}
              onChange={(e) => {
                patch({ line1: e.target.value });
                setOpen(true);
              }}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              placeholder="Start typing an address…"
              required={required}
              disabled={disabled}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
            />
          </div>
        ) : (
          <div className="addr-line1-plain">
            <MapPin size={16} aria-hidden className="addr-line1-ico" />
            <input
              id={`${idPrefix}-line1`}
              type="text"
              value={value.line1}
              onChange={(e) => {
                patch({ line1: e.target.value });
                setOpen(true);
              }}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              placeholder={disabled ? '—' : 'Start typing an address…'}
              required={required && !disabled}
              disabled={disabled}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
            />
          </div>
        )}
        {open && !disabled && (suggestions.length > 0 || searching) ? (
          <ul id={listId} className="addr-suggest" role="listbox">
            {searching && suggestions.length === 0 ? (
              <li className="addr-suggest-empty">Searching…</li>
            ) : (
              suggestions.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    role="option"
                    className="addr-suggest-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(hit)}
                  >
                    <MapPin size={14} aria-hidden />
                    <span>
                      <strong>{hit.line1 || hit.label.split(',')[0]}</strong>
                      <small>{hit.label}</small>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-line2`}>Address line 2 (optional)</label>
        <input
          id={`${idPrefix}-line2`}
          className={inputClass}
          type="text"
          value={value.line2}
          onChange={(e) => patch({ line2: e.target.value })}
          disabled={disabled}
          placeholder={disabled ? '—' : undefined}
        />
      </div>

      <div className={variant === 'onboarding' ? 'onboarding-address-grid' : 'addr-grid'}>
        <div className="field">
          <label htmlFor={`${idPrefix}-city`}>City</label>
          <input
            id={`${idPrefix}-city`}
            className={inputClass}
            type="text"
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
            required={required && !disabled}
            disabled={disabled}
            placeholder={disabled ? '—' : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-state`}>State / region</label>
          <input
            id={`${idPrefix}-state`}
            className={inputClass}
            type="text"
            value={value.state}
            onChange={(e) => patch({ state: e.target.value })}
            required={required && !disabled}
            disabled={disabled}
            placeholder={disabled ? '—' : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-postal`}>Postal code</label>
          <input
            id={`${idPrefix}-postal`}
            className={inputClass}
            type="text"
            value={value.postalCode}
            onChange={(e) => patch({ postalCode: e.target.value })}
            required={required && !disabled}
            disabled={disabled}
            placeholder={disabled ? '—' : undefined}
            autoComplete="postal-code"
          />
          {postalHint ? <p className="addr-postal-hint">{postalHint}</p> : null}
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-country`}>Country</label>
          <input
            id={`${idPrefix}-country`}
            className={inputClass}
            type="text"
            value={value.country}
            onChange={(e) => patch({ country: e.target.value })}
            required={required && !disabled}
            disabled={disabled}
            placeholder={disabled ? '—' : undefined}
          />
        </div>
      </div>
    </div>
  );
}
