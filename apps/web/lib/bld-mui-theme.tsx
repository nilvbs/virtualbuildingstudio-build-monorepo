'use client';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

/** BLD navy / ice tokens mapped onto MUI for the project-post wizard. */
export const bldMuiTheme = createTheme({
  palette: {
    primary: { main: '#00246b', dark: '#001a52', light: '#8ab6f9' },
    text: { primary: '#00246b', secondary: '#4a6fa8' },
    divider: 'rgba(0, 36, 107, 0.12)',
    background: { default: '#eef4fc', paper: '#ffffff' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'var(--font-sans), "DM Sans", system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
    subtitle2: { fontWeight: 700, color: '#00246b' },
    body2: { color: '#4a6fa8' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16, minHeight: 42 },
        outlined: { borderColor: 'rgba(0, 36, 107, 0.2)' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10, backgroundColor: '#fff' },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          paddingInline: 16,
          fontWeight: 600,
          color: '#00246b',
          borderColor: 'rgba(0, 36, 107, 0.2)',
          '&.Mui-selected': {
            backgroundColor: '#eaf1fd',
            color: '#00246b',
            borderColor: '#00246b',
            '&:hover': { backgroundColor: '#dfeafd' },
          },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: { marginLeft: 0 },
      },
    },
    MuiCheckbox: {
      defaultProps: { color: 'primary' },
    },
    MuiRadio: {
      defaultProps: { color: 'primary' },
    },
    MuiSelect: {
      defaultProps: { size: 'medium' },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
        outlined: { borderColor: 'rgba(0, 36, 107, 0.18)' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: 'rgba(0, 36, 107, 0.12)' },
      },
    },
  },
});

export function BldMuiProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={bldMuiTheme}>{children}</ThemeProvider>;
}
