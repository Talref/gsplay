// src/components/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, TextField, Box, Typography } from '@mui/material';

const Login = () => {
  const [credentials, setCredentials] = useState({ name: '', password: '' });
  const { login } = useAuth(); // Use the renamed login function

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(credentials); // Call the login function from AuthContext
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
      <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>
        Login
      </Button>
    </Box>
  );
};

export default Login;