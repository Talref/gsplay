import React from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const Unauthorized = () => {
  const theme = useTheme();

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, padding: 4, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Unauthorized Access
        </Typography>
        <Typography variant="body1" sx={{ mb: 4 }}>
          You do not have permission to access this page.
        </Typography>
        <Button variant="accent" component={Link} to="/">
          Go Back to Home
        </Button>
      </Box>

      {/* Footer */}
      <Footer />
    </Box>
  );
};

export default Unauthorized;