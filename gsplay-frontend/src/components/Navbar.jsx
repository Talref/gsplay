import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, useTheme } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const theme = useTheme();
  const { user, logout } = useAuth();

  return (
    <AppBar position="static" sx={{ backgroundColor: theme.palette.primary.main }}>
      <Toolbar>
        {/* Logo and title on the left */}
        <IconButton
          component={Link}
          to="/"
          color="inherit"
          edge="start"
          sx={{
            mr: 2,
            display: 'flex',
            alignItems: 'center',
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

        {/* Spacer to push buttons to the right */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Login/Signup or Logout buttons on the right */}
        {user ? (
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        ) : (
          <Box>
            <Button color="inherit" component={Link} to="/login">
              Login
            </Button>
            <Button color="inherit" component={Link} to="/signup">
              Signup
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;