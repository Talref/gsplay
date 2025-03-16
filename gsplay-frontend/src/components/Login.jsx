// src/components/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, TextField, Box } from '@mui/material';

const Login = ({ onSuccess }) => {
  const [credentials, setCredentials] = useState({ name: '', password: '' });
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(credentials);
      onSuccess(); // Close the dialog after successful login
    } catch (error) {
      alert(error.error || 'Login failed');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
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
      <Button type="submit" variant="contained" color="primary" sx={{ mt: 2, borderRadius: '10px' }}>
        Login
      </Button>
    </Box>
  );
};

export default Login;