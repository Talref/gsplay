// src/components/Home.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import Login from './Login'; // Import the Login component
import Signup from './Signup'; // Import the Signup component

const Home = () => {
  const { user, logout } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false); // State for Login dialog
  const [isSignupOpen, setIsSignupOpen] = useState(false); // State for Signup dialog

  // Open Login dialog
  const handleOpenLogin = () => {
    setIsLoginOpen(true);
  };

  // Close Login dialog
  const handleCloseLogin = () => {
    setIsLoginOpen(false);
  };

  // Open Signup dialog
  const handleOpenSignup = () => {
    setIsSignupOpen(true);
  };

  // Close Signup dialog
  const handleCloseSignup = () => {
    setIsSignupOpen(false);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh', // Full viewport height
        backgroundColor: 'background.default', // Dark background
        color: 'text.primary', // White text
      }}
    >
      <Typography variant="h4" gutterBottom>
        Welcome to GSplay, {user?.name || 'Guest'}!
      </Typography>

      {/* Login Button */}
      {!user && (
        <Box sx={{ mb: 4 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenLogin}
            sx={{ mb: 2, borderRadius: '10px' }} // Smaller radius
          >
            Login
          </Button>
        </Box>
      )}

      {/* Signup Button */}
      {!user && (
        <Button
          variant="contained"
          color="secondary"
          onClick={handleOpenSignup}
          sx={{ borderRadius: '10px' }} // Smaller radius
        >
          Signup
        </Button>
      )}

      {/* Logout Button */}
      {user && (
        <Button
          variant="contained"
          color="error"
          onClick={logout}
          sx={{ mt: 2, borderRadius: '10px' }} // Smaller radius
        >
          Logout
        </Button>
      )}

      {/* Login Dialog */}
      <Dialog open={isLoginOpen} onClose={handleCloseLogin}>
        <DialogTitle>Login</DialogTitle>
        <DialogContent>
          <Login onSuccess={handleCloseLogin} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLogin}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Signup Dialog */}
      <Dialog open={isSignupOpen} onClose={handleCloseSignup}>
        <DialogTitle>Signup</DialogTitle>
        <DialogContent>
          <Signup onSuccess={handleCloseSignup} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSignup}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Home;