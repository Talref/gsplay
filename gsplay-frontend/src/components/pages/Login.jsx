import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button, TextField, Box, Typography, useTheme } from '@mui/material'; // Add useTheme

const Login = ({ onSuccess }) => {
  const theme = useTheme(); // Access the theme
  const [credentials, setCredentials] = useState({ name: '', password: '' });
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(credentials);
      onSuccess();
    } catch (error) {
      alert(error.error || 'Login failed');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
      <Typography variant="h4">Login</Typography>
      <TextField
        label="Username"
        value={credentials.name}
        onChange={(e) => setCredentials({ ...credentials, name: e.target.value })}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Password"
        type="password"
        value={credentials.password}
        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
        fullWidth
        margin="normal"
      />
      <Button
        type="submit"
        variant="contained"
        sx={{
          mt: 2,
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.secondary.main,
        }}
      >
        Login
      </Button>
    </Box>
  );
};

export default Login;
