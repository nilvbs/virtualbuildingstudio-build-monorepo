import { Platform } from 'react-native';

/** Display face — matches web Fraunces headlines. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
};

/** Brand palette: ice #CADCFC · sky #8AB6F9 · navy #00246B — page stays white; brand colors tint sections. */
export const colors = {
  ink: '#00246B',
  text: '#00246B',
  muted: '#4a6fa8',
  faint: '#8AB6F9',
  panel: '#ffffff',
  panelAlt: '#CADCFC',
  page: '#ffffff',
  border: 'rgba(0, 36, 107, 0.12)',
  borderStrong: 'rgba(0, 36, 107, 0.2)',
  accent: '#00246B',
  accent2: '#8AB6F9',
  accentSoft: 'rgba(138, 182, 249, 0.28)',
  accentSoft2: '#CADCFC',
  ok: '#059669',
  okSoft: 'rgba(5, 150, 105, 0.12)',
  warn: '#b7791f',
  warnSoft: 'rgba(183, 121, 31, 0.12)',
  danger: '#dc2626',
  dangerSoft: 'rgba(220, 38, 38, 0.1)',
  violet: '#8AB6F9',
  violetSoft: 'rgba(138, 182, 249, 0.22)',
  amber: '#f59e0b',
  hero: '#00246B',
  ice: '#CADCFC',
  sky: '#8AB6F9',
  navy: '#00246B',
};

/** Brand gradient stops (navy → sky). */
export const gradient = {
  from: '#00246B',
  to: '#8AB6F9',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

type Shadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

function shadow(y: number, blur: number, opacity: number, elevation: number): Shadow {
  return {
    shadowColor: '#00246B',
    shadowOffset: { width: 0, height: y },
    shadowOpacity: Platform.OS === 'android' ? opacity * 1.2 : opacity,
    shadowRadius: blur,
    elevation,
  };
}

export const shadows = {
  sm: shadow(2, 8, 0.06, 2),
  md: shadow(8, 20, 0.1, 6),
  lg: shadow(16, 36, 0.16, 12),
  accent: {
    shadowColor: '#00246B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  } as Shadow,
};
