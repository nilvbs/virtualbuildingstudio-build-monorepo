'use client';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

/** BLD purple brand tokens for the project-post wizard. */
export const bldMuiTheme = createTheme({
  palette: {
    primary: { main: '#5b52e0', dark: '#4a42c9', light: '#9b94ff' },
    text: { primary: '#2a2558', secondary: '#6b668c' },
    divider: 'rgba(91, 82, 224, 0.14)',
    background: { default: '#f5f6fa', paper: '#ffffff' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-sans), "DM Sans", system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
    subtitle2: { fontWeight: 700, color: '#2a2558' },
    body2: { color: '#6b668c' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16, minHeight: 42 },
        outlined: { borderColor: 'rgba(91, 82, 224, 0.22)', color: '#2a2558' },
        contained: {
          backgroundColor: '#5b52e0',
          '&:hover': { backgroundColor: '#4a42c9' },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#fff',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(91, 82, 224, 0.35)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#5b52e0',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          paddingInline: 16,
          fontWeight: 600,
          color: '#2a2558',
          borderColor: 'rgba(91, 82, 224, 0.2)',
          '&.Mui-selected': {
            backgroundColor: '#eeeaff',
            color: '#4a42c9',
            borderColor: '#5b52e0',
            '&:hover': { backgroundColor: '#e4e0ff' },
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
        outlined: { borderColor: 'rgba(91, 82, 224, 0.2)' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: 'rgba(91, 82, 224, 0.14)' },
      },
    },
  },
});

export function BldMuiProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={bldMuiTheme}>{children}</ThemeProvider>;
}
