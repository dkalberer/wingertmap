import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#15803d',
      light: '#22c55e',
      dark: '#14532d',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#854d0e',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f0fdf4',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { variant: 'contained', disableElevation: true },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
  },
})

export default theme
