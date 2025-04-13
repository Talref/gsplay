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
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0a1529',
          color: '#7fffd4',
          transition: 'none !important',
        },
        // Global link styles
        a: {
          color: '#7fffd4', // Use your secondary color
          textDecoration: 'underline',
          transition: 'color 0.2s ease',
          '&:hover': {
            color: '#a9ffe2', // Brighter version for hover
            textDecoration: 'underline',
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#7fffd4', // Same as global links
          textDecoration: 'underline',
          fontWeight: 500,
          transition: 'color 0.2s ease',
          '&:hover': {
            color: '#a9ffe2', // Brighter hover
            textDecoration: 'underline',
            cursor: 'pointer',
          },
        },
      },
      variants: [
        {
          props: { variant: 'button' },
          style: {
            textDecoration: 'none', // Links styled as buttons shouldn't be underlined
            '&:hover': {
              textDecoration: 'none',
            },
          },
        },
      ],
    },
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
        body1: {
          color: '#7fffd4', // Use secondary text color for body1
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
    MuiListItem: {
      styleOverrides: {
        root: {
          backgroundColor: '#00284d',
          borderRadius: '5px',
          marginBottom: '8px',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(127, 255, 212, 0.2)',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: '#7fffd4',
          fontWeight: '500',
        },
      },
    },
  },
});

export default theme;