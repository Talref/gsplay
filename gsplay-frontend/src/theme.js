import { createTheme } from '@mui/material/styles';
export default createTheme({
  palette: { mode: 'dark', primary: { main: '#7fffd4', contrastText: '#0a1529' }, background: { default: '#0a1529', paper: '#102344' }, text: { primary: '#edfdf8', secondary: '#a7c9cf' }, error: { main: '#ff7b7b' } }, shape: { borderRadius: 14 },
  typography: { fontFamily: 'Inter, system-ui, sans-serif', h1: { fontFamily: 'RetroGaming8Bit, monospace', fontSize: 'clamp(1.45rem,4vw,2.7rem)', lineHeight: 1.45 }, h2: { fontWeight: 800 }, button: { fontWeight: 800, textTransform: 'none' } },
  components: { MuiCssBaseline: { styleOverrides: { body: { background: 'radial-gradient(circle at 0 0,#153660 0,#0a1529 46rem)', minHeight: '100vh' } } }, MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(127,255,212,.14)' } } }, MuiButton: { styleOverrides: { root: { borderRadius: 10 } } } }
});