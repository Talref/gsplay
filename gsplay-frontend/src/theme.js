// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark', // Enable dark mode
    primary: {
      main: '#001f3f', // Navy blue
    },
    secondary: {
      main: '#7fffd4', // Aquamarine
    },
    background: {
      default: '#001a4d', // Dark background
      paper: '#002b80', // Slightly lighter for cards/containers
    },
    text: {
      primary: '#b3ffe6', // Lighter text
      secondary: '#7fffd4', // Aquamarine text
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '5px', // Smaller radius for buttons
        },
      },
    },
  },
});

export default theme;