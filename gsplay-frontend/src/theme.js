// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#001f3f', 
    },
    secondary: {
      main: '#7fffd4', 
    },
    background: {
      default: '#001a4d', 
      paper: '#002b80', 
    },
    text: {
      primary: '#b3ffe6', 
      secondary: '#7fffd4', 
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '5px', 
        },
      },
    },
  },
});

export default theme;