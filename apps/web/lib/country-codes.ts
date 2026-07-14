export interface CountryDial {
  iso: string;
  name: string;
  dial: string;
  /** National number example shown in the hint (no country code). */
  example: string;
  /** Compact placeholder for the input. */
  placeholder: string;
}

/** Common calling codes for signup phone entry. */
export const COUNTRY_DIALS: CountryDial[] = [
  { iso: 'US', name: 'United States', dial: '+1', example: '(415) 555-2671', placeholder: '4155552671' },
  { iso: 'CA', name: 'Canada', dial: '+1', example: '(416) 555-0199', placeholder: '4165550199' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44', example: '7911 123456', placeholder: '7911123456' },
  { iso: 'IN', name: 'India', dial: '+91', example: '98765 43210', placeholder: '9876543210' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971', example: '50 123 4567', placeholder: '501234567' },
  { iso: 'AU', name: 'Australia', dial: '+61', example: '412 345 678', placeholder: '412345678' },
  { iso: 'DE', name: 'Germany', dial: '+49', example: '151 23456789', placeholder: '15123456789' },
  { iso: 'FR', name: 'France', dial: '+33', example: '6 12 34 56 78', placeholder: '612345678' },
  { iso: 'IE', name: 'Ireland', dial: '+353', example: '85 123 4567', placeholder: '851234567' },
  { iso: 'NL', name: 'Netherlands', dial: '+31', example: '6 12345678', placeholder: '612345678' },
  { iso: 'SG', name: 'Singapore', dial: '+65', example: '8123 4567', placeholder: '81234567' },
  { iso: 'NZ', name: 'New Zealand', dial: '+64', example: '21 123 4567', placeholder: '211234567' },
  { iso: 'ZA', name: 'South Africa', dial: '+27', example: '82 123 4567', placeholder: '821234567' },
  { iso: 'BR', name: 'Brazil', dial: '+55', example: '11 91234-5678', placeholder: '11912345678' },
  { iso: 'MX', name: 'Mexico', dial: '+52', example: '55 1234 5678', placeholder: '5512345678' },
  { iso: 'JP', name: 'Japan', dial: '+81', example: '90-1234-5678', placeholder: '9012345678' },
  { iso: 'KR', name: 'South Korea', dial: '+82', example: '10-1234-5678', placeholder: '1012345678' },
  { iso: 'PH', name: 'Philippines', dial: '+63', example: '917 123 4567', placeholder: '9171234567' },
  { iso: 'PK', name: 'Pakistan', dial: '+92', example: '300 1234567', placeholder: '3001234567' },
  { iso: 'BD', name: 'Bangladesh', dial: '+880', example: '1712 345678', placeholder: '1712345678' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966', example: '50 123 4567', placeholder: '501234567' },
  { iso: 'QA', name: 'Qatar', dial: '+974', example: '3312 3456', placeholder: '33123456' },
  { iso: 'KW', name: 'Kuwait', dial: '+965', example: '5000 1234', placeholder: '50001234' },
  { iso: 'EG', name: 'Egypt', dial: '+20', example: '100 123 4567', placeholder: '1001234567' },
  { iso: 'NG', name: 'Nigeria', dial: '+234', example: '802 123 4567', placeholder: '8021234567' },
  { iso: 'KE', name: 'Kenya', dial: '+254', example: '712 123456', placeholder: '712123456' },
  { iso: 'ES', name: 'Spain', dial: '+34', example: '612 34 56 78', placeholder: '612345678' },
  { iso: 'IT', name: 'Italy', dial: '+39', example: '312 345 6789', placeholder: '3123456789' },
  { iso: 'PT', name: 'Portugal', dial: '+351', example: '912 345 678', placeholder: '912345678' },
  { iso: 'SE', name: 'Sweden', dial: '+46', example: '70 123 45 67', placeholder: '701234567' },
  { iso: 'CH', name: 'Switzerland', dial: '+41', example: '78 123 45 67', placeholder: '781234567' },
  { iso: 'PL', name: 'Poland', dial: '+48', example: '512 345 678', placeholder: '512345678' },
  { iso: 'TR', name: 'Turkey', dial: '+90', example: '532 123 4567', placeholder: '5321234567' },
  { iso: 'CN', name: 'China', dial: '+86', example: '138 0013 8000', placeholder: '13800138000' },
  { iso: 'HK', name: 'Hong Kong', dial: '+852', example: '9123 4567', placeholder: '91234567' },
  { iso: 'TW', name: 'Taiwan', dial: '+886', example: '912 345 678', placeholder: '912345678' },
  { iso: 'TH', name: 'Thailand', dial: '+66', example: '81 234 5678', placeholder: '812345678' },
  { iso: 'MY', name: 'Malaysia', dial: '+60', example: '12-345 6789', placeholder: '123456789' },
  { iso: 'ID', name: 'Indonesia', dial: '+62', example: '812-3456-7890', placeholder: '81234567890' },
  { iso: 'VN', name: 'Vietnam', dial: '+84', example: '91 234 56 78', placeholder: '912345678' },
];

export const DEFAULT_COUNTRY_ISO = 'IN';

export function findCountry(iso: string): CountryDial {
  return COUNTRY_DIALS.find((c) => c.iso === iso) ?? COUNTRY_DIALS[0]!;
}

/** Build E.164 from dial code + national digits (strips spaces/punctuation/leading zeros). */
export function toE164(dial: string, national: string): string {
  const trimmed = national.trim();
  const dialDigits = dial.replace(/\D/g, '');

  // Pasted full international number, e.g. +919509393218
  if (trimmed.startsWith('+')) {
    const intl = trimmed.replace(/\D/g, '');
    return intl ? `+${intl}` : dial;
  }

  let digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return dial;

  // User typed country code without +, e.g. 919509393218 with dial +91
  if (dialDigits && digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    return `+${digits}`;
  }

  return `${dial}${digits}`;
}

export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}
