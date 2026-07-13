'use client';

import { useId, useMemo } from 'react';
import { Phone } from 'lucide-react';
import {
  COUNTRY_DIALS,
  DEFAULT_COUNTRY_ISO,
  findCountry,
  toE164,
  type CountryDial,
} from '../lib/country-codes';

export interface PhoneInputValue {
  countryIso: string;
  national: string;
}

interface PhoneInputProps {
  id?: string;
  label?: string;
  value: PhoneInputValue;
  onChange: (next: PhoneInputValue) => void;
  required?: boolean;
  disabled?: boolean;
}

export function PhoneInput({
  id,
  label = 'Phone',
  value,
  onChange,
  required,
  disabled,
}: PhoneInputProps) {
  const autoId = useId();
  const phoneId = id ?? autoId;
  const countryId = `${phoneId}-country`;
  const country = useMemo(() => findCountry(value.countryIso), [value.countryIso]);

  return (
    <div className="field phone-field">
      <label htmlFor={phoneId}>{label}</label>
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
      <span className="hint">
        Example: {country.dial} {country.example}
      </span>
    </div>
  );
}

export function phoneInputToE164(value: PhoneInputValue): string {
  const country: CountryDial = findCountry(value.countryIso);
  return toE164(country.dial, value.national);
}

export function defaultPhoneInput(): PhoneInputValue {
  return { countryIso: DEFAULT_COUNTRY_ISO, national: '' };
}
