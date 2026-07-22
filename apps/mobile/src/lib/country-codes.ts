export interface CountryDial {
  iso: string;
  name: string;
  dial: string;
  example: string;
  placeholder: string;
}

export interface PhoneInputValue {
  countryIso: string;
  national: string;
}

export const COUNTRY_DIALS: CountryDial[] = [
  { iso: 'US', name: 'United States', dial: '+1', example: '(415) 555-2671', placeholder: '4155552671' },
  { iso: 'CA', name: 'Canada', dial: '+1', example: '(416) 555-0199', placeholder: '4165550199' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44', example: '7911 123456', placeholder: '7911123456' },
  { iso: 'IN', name: 'India', dial: '+91', example: '98765 43210', placeholder: '9876543210' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971', example: '50 123 4567', placeholder: '501234567' },
  { iso: 'AU', name: 'Australia', dial: '+61', example: '412 345 678', placeholder: '412345678' },
  { iso: 'DE', name: 'Germany', dial: '+49', example: '151 23456789', placeholder: '15123456789' },
  { iso: 'FR', name: 'France', dial: '+33', example: '6 12 34 56 78', placeholder: '612345678' },
  { iso: 'SG', name: 'Singapore', dial: '+65', example: '8123 4567', placeholder: '81234567' },
  { iso: 'PH', name: 'Philippines', dial: '+63', example: '917 123 4567', placeholder: '9171234567' },
  { iso: 'PK', name: 'Pakistan', dial: '+92', example: '300 1234567', placeholder: '3001234567' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966', example: '50 123 4567', placeholder: '501234567' },
  { iso: 'NG', name: 'Nigeria', dial: '+234', example: '802 123 4567', placeholder: '8021234567' },
];

export const DEFAULT_COUNTRY_ISO = 'IN';

export function findCountry(iso: string): CountryDial {
  return COUNTRY_DIALS.find((c) => c.iso === iso) ?? COUNTRY_DIALS[0]!;
}

export function toE164(dial: string, national: string): string {
  const trimmed = national.trim();
  const dialDigits = dial.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    const intl = trimmed.replace(/\D/g, '');
    return intl ? `+${intl}` : dial;
  }
  let digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return dial;
  if (dialDigits && digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    return `+${digits}`;
  }
  return `${dial}${digits}`;
}

export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

export function phoneInputToE164(value: PhoneInputValue): string {
  return toE164(findCountry(value.countryIso).dial, value.national);
}

export function phoneInputIsValid(value: PhoneInputValue): boolean {
  return isE164(phoneInputToE164(value)) && value.national.replace(/\D/g, '').length >= 6;
}

export function defaultPhoneInput(): PhoneInputValue {
  return { countryIso: DEFAULT_COUNTRY_ISO, national: '' };
}

export function e164ToPhoneInput(phone: string): PhoneInputValue {
  if (!phone || !phone.startsWith('+')) {
    return defaultPhoneInput();
  }
  const digits = phone.slice(1);
  const sorted = [...COUNTRY_DIALS].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of sorted) {
    const dialDigits = country.dial.replace(/\D/g, '');
    if (digits.startsWith(dialDigits)) {
      return { countryIso: country.iso, national: digits.slice(dialDigits.length) };
    }
  }
  return { countryIso: DEFAULT_COUNTRY_ISO, national: digits };
}
