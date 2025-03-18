import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute';

const AdminPage = () => {
  const theme = useTheme();

  return (
    <ProtectedRoute adminOnly>
      <Box sx={theme.components.MuiBox.styleOverrides.root}>
        {/* Navbar at the top */}
        <Navbar />

        {/* Main content */}
        <Box component="main" sx={{ flexGrow: 1, padding: 4 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body1">
            Welcome to the admin dashboard. Here you can manage users, games, and other settings.
          </Typography>
        </Box>

        {/* Footer */}
        <Footer />
      </Box>
    </ProtectedRoute>
  );
};

export default AdminPage;