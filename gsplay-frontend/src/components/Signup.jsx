import React, { useState } from 'react';
import { signup } from '../services/api';
import { Button, TextField, Box, useTheme } from '@mui/material';

const Signup = ({ onSuccess }) => {
  const theme = useTheme();
  const [userData, setUserData] = useState({ name: '', password: '', isAdmin: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup(userData);
      alert('Signup successful! Please login.');
      onSuccess();
    } catch (error) {
      alert(error.error || 'Signup failed');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
      <TextField
        label="Username"
        value={userData.name}
        onChange={(e) => setUserData({ ...userData, name: e.target.value })}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Password"
        type="password"
        value={userData.password}
        onChange={(e) => setUserData({ ...userData, password: e.target.value })}
        fullWidth
        margin="normal"
      />
      <Button
        type="submit"
        variant="contained"
        sx={{
          mt: 2,
          borderRadius: '10px',
          backgroundColor: theme.palette.primary.main, 
          color: theme.palette.secondary.main, 
        }}
      >
        Signup
      </Button>
    </Box>
  );
};

export default Signup;