import { createTheme } from '@mui/material/styles';

// The North Bank brand: deep navy primary, teal accent, soft neutral background.
export function buildTheme(mode = 'light') {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#7ea2ff' : '#14306e', contrastText: dark ? '#0b1530' : '#ffffff' },
      secondary: { main: dark ? '#4fd1c5' : '#0f8a80' },
      success: { main: dark ? '#4ade80' : '#1b7f4b' },
      warning: { main: dark ? '#fbbf24' : '#b45309' },
      error: { main: dark ? '#f87171' : '#b42318' },
      background: dark ? { default: '#0b1220', paper: '#121b2e' } : { default: '#f4f6fb', paper: '#ffffff' },
      text: dark ? { primary: '#e6ebf5', secondary: '#9aa6bf' } : { primary: '#111a2e', secondary: '#55627a' },
      divider: dark ? '#22304b' : '#e3e8f1',
    },
    shape: { borderRadius: 10 },
    spacing: 8,
    typography: {
      fontFamily: '"Inter Variable", Inter, Roboto, system-ui, sans-serif',
      h4: { fontWeight: 750, letterSpacing: '-0.02em' },
      h5: { fontWeight: 720, letterSpacing: '-0.01em' },
      h6: { fontWeight: 680 },
      subtitle2: { fontWeight: 650 },
      button: { textTransform: 'none', fontWeight: 650 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 8, paddingInline: 18 } } },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 12 } },
      },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 } } },
      MuiTextField: { defaultProps: { fullWidth: true } },
      MuiChip: { styleOverrides: { root: { fontWeight: 650 } } },
      MuiTableCell: { styleOverrides: { head: { fontWeight: 700, whiteSpace: 'nowrap' } } },
    },
  });
}
