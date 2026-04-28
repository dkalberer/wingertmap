import { createTheme, alpha } from '@mui/material/styles'

// Raw color palette — vineyard-themed (green/brown/stone)
const RAW = {
  green900: '#14532d',
  green800: '#15803d',
  green700: '#166534',
  green200: '#bbf7d0',
  green50:  '#f0fdf4',
  brown800: '#854d0e',
  stone900: '#1c1917',
  stone500: '#78716c',
  stone400: '#a8a29e',
  stone200: '#e7e5e4',
} as const

const theme = createTheme({
  palette: {
    primary: {
      main:         RAW.green800,
      light:        RAW.green200,
      dark:         RAW.green900,
      contrastText: '#ffffff',
    },
    secondary: {
      main:         RAW.brown800,
      contrastText: '#ffffff',
    },
    background: {
      default: RAW.green50,
      paper:   '#ffffff',
    },
    text: {
      primary:   RAW.stone900,  // warmer near-black vs. pure #000
      secondary: RAW.stone500,
      disabled:  RAW.stone400,
    },
    divider: RAW.stone200,
    action: {
      hover:    alpha(RAW.green800, 0.06),  // green-tinted hover instead of grey
      selected: alpha(RAW.green800, 0.12),
    },
  },

  shape: {
    borderRadius: 8,  // up from MUI default 4 — softer, more modern
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    body2: { lineHeight: 1.5 },
    caption: { lineHeight: 1.4 },
    overline: { letterSpacing: '0.08em', fontWeight: 600, fontSize: '0.7rem' },
  },

  components: {
    MuiButton: {
      defaultProps: { variant: 'contained', disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',  // no ALL-CAPS — feels dated
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          // Prevent iOS Safari from zooming in on focused inputs (zoom triggers at < 16px)
          fontSize: '16px',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${RAW.stone200}`, borderRadius: 12 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: `1px solid ${RAW.stone200}` },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
})

export default theme
