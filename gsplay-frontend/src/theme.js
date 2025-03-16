import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#001f3f',
    },
    secondary: {
      main: '#7fffd4',
    },
    warning: {
      main: '#ff4444',
    },
    background: {
      default: '#0a1529',
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
      variants: [
        {
          props: { variant: 'default' },
          style: {
            backgroundColor: '#00284d',
            color: '#7fffd4',
            '&:hover': {
              backgroundColor: '#002b80',
            },
          },
        },
        {
          props: { variant: 'accent' },
          style: {
            backgroundColor: '#7fffd4',
            color: '#001f3f',
            '&:hover': {
              backgroundColor: '#66ccaa',
            },
          },
        },
        {
          props: { variant: 'warning' },
          style: {
            backgroundColor: '#ff4444',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#cc3636',
            },
          },
        },
      ],
    },
    MuiTypography: {
      styleOverrides: {
        h1: {
          color: '#7fffd4',
        },
        h2: {
          color: '#7fffd4',
        },
        h3: {
          color: '#7fffd4',
        },
        h4: {
          color: '#7fffd4',
        },
        h5: {
          color: '#7fffd4',
        },
        h6: {
          color: '#7fffd4',
        },
      },
    },
    MuiBox: {
      styleOverrides: {
        root: {
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: '#0a1529',
        },
      },
    },
    // Add styling for the games list
    MuiListItem: {
      styleOverrides: {
        root: {
          backgroundColor: '#00284d', // Match the default button color
          borderRadius: '5px', // Rounded corners
          marginBottom: '8px', // Space between items
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out', // Smooth hover animation
          '&:hover': {
            transform: 'translateY(-2px)', // Slight lift on hover
            boxShadow: '0 4px 8px rgba(127, 255, 212, 0.2)', // Glow effect with secondary color
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: '#7fffd4', // Secondary color for game names
          fontWeight: '500', // Slightly bold
        },
      },
    },
  },
});

export default theme;