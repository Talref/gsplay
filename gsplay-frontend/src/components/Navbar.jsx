import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, useTheme, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Login from './Login';
import Signup from './Signup';

const Navbar = () => {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);

  const handleOpenLogin = () => setIsLoginOpen(true);
  const handleCloseLogin = () => setIsLoginOpen(false);

  const handleOpenSignup = () => setIsSignupOpen(true);
  const handleCloseSignup = () => setIsSignupOpen(false);

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: theme.palette.primary.main }}>
        <Toolbar>
          <IconButton
            component={Link}
            to="/"
            edge="start"
            sx={{
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: theme.palette.primary.main,
            }}
          >
            <img
              src="/gslogo.png"
              alt="GSplay Logo"
              style={{ width: '45px', height: '45px', marginRight: '10px' }}
            />
            <Typography variant="h5" component="div">
              GSplay
            </Typography>
          </IconButton>

          <Button component={Link} to="/library" variant="default" sx={{ ml: 2 }}>
            Your Library
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          {user ? (
            <Button variant="warning" onClick={logout}>
              Logout
            </Button>
          ) : (
            <Box>
              <Button variant='default' color='accent' onClick={handleOpenLogin}>
                Login
              </Button>
              <Button variant='accent' onClick={handleOpenSignup} sx={{ ml: 1 }}>
                Signup
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

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
    </>
  );
};

export default Navbar;