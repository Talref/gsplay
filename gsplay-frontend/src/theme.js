import { createTheme } from '@mui/material/styles'

const colors = {
  background: '#0a1529',
  backgroundRgb: '10, 21, 41',
  surface: '#102344',
  surfaceHighlight: '#154271',
  surfaceHighlightRgb: '21, 66, 113',
  surfaceDeep: '#050b16',
  primary: '#7fffd4',
  primaryRgb: '127, 255, 212',
  secondary: '#82aaff',
  text: '#b8d4d8',
  textRgb: '184, 212, 216'
}

export default createTheme({
  palette: {
    mode: 'dark',
    primary: { main: colors.primary, contrastText: colors.background },
    secondary: { main: colors.secondary, contrastText: colors.background },
    background: { default: colors.background, paper: colors.surface },
    text: { primary: colors.text, secondary: '#8badb6' },
    divider: `rgba(${colors.primaryRgb}, .14)`,
    error: { main: '#ff7b7b' },
    warning: { main: '#f6c177' },
    success: { main: '#7bd88f' },
    info: { main: colors.secondary }
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    h1: {
      fontFamily: 'RetroGaming8Bit, monospace',
      fontSize: 'clamp(1.45rem,4vw,2.7rem)',
      lineHeight: 1.45
    },
    h2: { color: colors.primary, fontWeight: 800 },
    h3: { color: colors.primary },
    h4: { color: colors.primary },
    h5: { color: colors.primary },
    h6: { color: colors.primary },
    button: { fontWeight: 800, textTransform: 'none' },
    subtitle1: { color: colors.primary, fontWeight: 800 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--gs-bg': colors.background,
          '--gs-bg-rgb': colors.backgroundRgb,
          '--gs-surface': colors.surface,
          '--gs-surface-highlight': colors.surfaceHighlight,
          '--gs-surface-highlight-rgb': colors.surfaceHighlightRgb,
          '--gs-surface-deep': colors.surfaceDeep,
          '--gs-primary': colors.primary,
          '--gs-primary-rgb': colors.primaryRgb,
          '--gs-text-rgb': colors.textRgb
        },
        body: {
          background: `radial-gradient(circle at 0 0, #153660 0, ${colors.background} 46rem)`,
          minHeight: '100vh'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: `1px solid rgba(${colors.primaryRgb}, .14)` }
      }
    },
    MuiButton: { styleOverrides: { root: { borderRadius: 10 } } }
  }
})
