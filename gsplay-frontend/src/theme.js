import { createTheme } from '@mui/material/styles';

// Design tokens for consistent theming
const designTokens = {
  colors: {
    retro: {
      background: '#0a1529',  // Main app background
      surface: '#00284d',     // Card backgrounds, secondary surfaces
      surfaceHover: '#002b80', // Hover states for surfaces (original paper color)
      accent: '#7fffd4',      // Primary accent color (cyan/green)
      accentHover: '#a9ffe2', // Brighter accent for hovers
      warning: '#ff4444',     // Error/warning states
      warningHover: '#cc3636', // Darker warning for hovers
      contrast: '#001f3f',    // Dark contrast color for buttons
      textPrimary: '#b3ffe6', // Main body text
      textSecondary: '#7fffd4', // Secondary text (headers, links)
    }
  },
  spacing: {
    xs: 4,  // Small spacing (buttons, small gaps)
    sm: 8,  // Standard small (card padding, list items)
    md: 16, // Medium spacing (content sections)
    lg: 24, // Large spacing (major sections)
    xl: 32  // Extra large (page margins)
  },
  borderRadius: {
    small: 4,   // Small elements
    medium: 5,  // Buttons, form elements
    large: 12   // Cards, major containers
  },
  shadows: {
    small: '0 1px 1px rgba(0, 0, 0, 0.2)',
    medium: '0 4px 8px rgba(127, 255, 212, 0.2)' // Keeping the retro glow effect
  }
};

const theme = createTheme({
  // Expose tokens to components
  tokens: designTokens,

  palette: {
    primary: {
      main: designTokens.colors.retro.contrast, // #001f3f
    },
    secondary: {
      main: designTokens.colors.retro.accent, // #7fffd4
    },
    warning: {
      main: designTokens.colors.retro.warning, // #ff4444
    },
    background: {
      default: designTokens.colors.retro.background, // #0a1529
      paper: designTokens.colors.retro.surfaceHover, // #002b80 (original paper)
    },
    text: {
      primary: designTokens.colors.retro.textPrimary, // #b3ffe6
      secondary: designTokens.colors.retro.textSecondary, // #7fffd4
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: designTokens.colors.retro.background,
          color: designTokens.colors.retro.textSecondary,
          transition: 'none !important',
        },
        // Global link styles
        a: {
          color: designTokens.colors.retro.textSecondary, // Use accent color for links
          textDecoration: 'underline',
          transition: 'color 0.2s ease',
          '&:hover': {
            color: designTokens.colors.retro.accentHover, // Brighter version for hover
            textDecoration: 'underline',
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: designTokens.colors.retro.textSecondary, // Same as global links
          textDecoration: 'underline',
          fontWeight: 500,
          transition: 'color 0.2s ease',
          '&:hover': {
            color: designTokens.colors.retro.accentHover, // Brighter hover
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
          borderRadius: `${designTokens.borderRadius.medium}px`,
        },
      },
      variants: [
        {
          props: { variant: 'default' },
          style: {
            backgroundColor: designTokens.colors.retro.surface,
            color: designTokens.colors.retro.accent,
            fontSize: '0.875rem',
            '&:hover': {
              backgroundColor: designTokens.colors.retro.surfaceHover,
            },
          },
        },
        {
          props: { variant: 'accent' },
          style: {
            backgroundColor: designTokens.colors.retro.accent,
            color: designTokens.colors.retro.contrast,
            '&:hover': {
              backgroundColor: '#66ccaa', // Custom hover, keeping the original saturation
            },
          },
        },
        {
          props: { variant: 'warning' },
          style: {
            backgroundColor: designTokens.colors.retro.warning,
            color: '#ffffff',
            '&:hover': {
              backgroundColor: designTokens.colors.retro.warningHover,
            },
          },
        },
        {
          props: { variant: 'retro' },
          style: {
            backgroundColor: designTokens.colors.retro.surface,
            color: designTokens.colors.retro.accent,
            fontFamily: 'RetroGaming8Bit, monospace',
            fontSize: '0.6rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: `${designTokens.spacing.xs}px ${designTokens.spacing.sm}px`,
            '&:hover': {
              backgroundColor: designTokens.colors.retro.surfaceHover,
            },
          },
        },

      ],
    },
    MuiTypography: {
      styleOverrides: {
        h1: {
          color: designTokens.colors.retro.textSecondary,
        },
        h2: {
          color: designTokens.colors.retro.textSecondary,
        },
        h3: {
          color: designTokens.colors.retro.textSecondary,
        },
        h4: {
          color: designTokens.colors.retro.textSecondary,
        },
        h5: {
          color: designTokens.colors.retro.textSecondary,
        },
        h6: {
          color: designTokens.colors.retro.textSecondary,
        },
        body1: {
          color: designTokens.colors.retro.textSecondary,
        },
      },
      variants: [
        {
          props: { variant: 'retroTitle' },
          style: {
            fontFamily: 'RetroGaming8Bit, monospace',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: designTokens.colors.retro.textSecondary,
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
          },
        },
        {
          props: { variant: 'retroTitleSmall' },
          style: {
            fontFamily: 'RetroGaming8Bit, monospace',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: designTokens.colors.retro.textSecondary,
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
          },
        },
        {
          props: { variant: 'retroText' },
          style: {
            fontFamily: 'RetroGaming8Bit, monospace',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: designTokens.colors.retro.textSecondary,
            textShadow: '1px 1px 1px rgba(0, 0, 0, 0.2)',
          },
        },
        {
          props: { variant: 'retroTextSmall' },
          style: {
            fontFamily: 'RetroGaming8Bit, monospace',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: designTokens.colors.retro.textSecondary,
            textShadow: '1px 1px 1px rgba(0, 0, 0, 0.15)',
          },
        },
      ],
    },
    MuiBox: {
      styleOverrides: {
        root: {
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: designTokens.colors.retro.background,
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          backgroundColor: designTokens.colors.retro.surface,
          borderRadius: `${designTokens.borderRadius.medium}px`,
          marginBottom: designTokens.spacing.sm,
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: designTokens.shadows.medium,
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: designTokens.colors.retro.accent,
          fontWeight: '500',
        },
      },
    },
  },
});

export default theme;
