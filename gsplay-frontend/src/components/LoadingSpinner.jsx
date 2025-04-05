import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2,
        backgroundColor: theme.palette.background.default
      }}
    >
      <CircularProgress 
        size={60}
        thickness={5}
        sx={{ 
          color: theme.palette.secondary.main,
          animationDuration: '800ms' 
        }}
      />
      <Typography 
        variant="h6" 
        sx={{ 
          color: theme.palette.text.primary,
          textShadow: `0 0 8px ${theme.palette.secondary.main}`
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingSpinner;