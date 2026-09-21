'use client';

import { useId, useMemo } from 'react';
import { Phone } from 'lucide-react';
import {
  COUNTRY_DIALS,
  DEFAULT_COUNTRY_ISO,
  findCountry,
  isE164,
  toE164,
  type CountryDial,
} from '../lib/country-codes';

export interface PhoneInputValue {
  countryIso: string;
  national: string;
}

interface PhoneInputProps {
  id?: string;
  /** Pass `null` to omit the label (when the parent already provides one). */
  label?: string | null;
  value: PhoneInputValue;
  onChange: (next: PhoneInputValue) => void;
  required?: boolean;
  disabled?: boolean;
  /** Show dialling example under the inputs. Default off. */
  showExample?: boolean;
}

export function PhoneInput({
  id,
  label = 'Phone',
  value,
  onChange,
  required,
  disabled,
  showExample = false,
}: PhoneInputProps) {
  const autoId = useId();
  const phoneId = id ?? autoId;
  const countryId = `${phoneId}-country`;
  const country = useMemo(() => findCountry(value.countryIso), [value.countryIso]);

  return (
    <div className={`field phone-field${label == null ? ' phone-field--bare' : ''}`}>
      {label != null ? <label htmlFor={phoneId}>{label}</label> : null}
      <div className="phone-row">
        <select
          id={countryId}
          className="phone-country"
          aria-label="Country calling code"
          value={value.countryIso}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, countryIso: e.target.value, national: '' })}
        >
          {COUNTRY_DIALS.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} ({c.dial})
            </option>
          ))}
        </select>
        <div className="phone-national">
          <Phone size={16} aria-hidden />
          <input
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required={required}
            disabled={disabled}
            placeholder={country.placeholder}
            value={value.national}
            onChange={(e) => onChange({ ...value, national: e.target.value })}
          />
        </div>
      </div>
      {showExample ? (
        <span className="hint">
          Example: {country.dial} {country.example}
        </span>
      ) : null}
    </div>
  );
}

export function phoneInputToE164(value: PhoneInputValue): string {
  const country: CountryDial = findCountry(value.countryIso);
  return toE164(country.dial, value.national);
}

export function phoneInputIsValid(value: PhoneInputValue): boolean {
  return isE164(phoneInputToE164(value)) && value.national.replace(/\D/g, '').length >= 6;
}

export function defaultPhoneInput(): PhoneInputValue {
  return { countryIso: DEFAULT_COUNTRY_ISO, national: '' };
}

/** Best-effort parse of an E.164 string into the phone input controls. */
export function phoneInputFromE164(e164: string | null | undefined): PhoneInputValue | null {
  const raw = (e164 ?? '').trim();
  if (!raw.startsWith('+')) return null;
  const sorted = [...COUNTRY_DIALS].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (raw.startsWith(c.dial)) {
      return { countryIso: c.iso, national: raw.slice(c.dial.length).replace(/\D/g, '') };
    }
  }
  return { countryIso: DEFAULT_COUNTRY_ISO, national: raw.replace(/^\+/, '').replace(/\D/g, '') };
}

