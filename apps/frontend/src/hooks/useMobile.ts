import { useMediaQuery, useTheme } from '@mui/material'

export function useMobile(): boolean {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('sm'))
}
