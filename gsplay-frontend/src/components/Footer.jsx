import { Box, Typography, useTheme } from '@mui/material';

const Footer = () => {
  const theme = useTheme(); 

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: theme.palette.primary.main, 
        color: theme.palette.secondary.main, 
        textAlign: 'center',
      }}
    >
      <Typography variant="body1">
        Made with <span role="img" aria-label="heart">❤️</span> and AI
      </Typography>
    </Box>
  );
};

export default Footer;