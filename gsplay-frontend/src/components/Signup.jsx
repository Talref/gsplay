// src/components/Signup.jsx
import React, { useState } from 'react';
import { signup } from '../services/api';
import { Button, TextField, Box } from '@mui/material';

const Signup = ({ onSuccess }) => {
  const [userData, setUserData] = useState({ name: '', password: '', isAdmin: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup(userData);
      alert('Signup successful! Please login.');
      onSuccess(); // Close the dialog after successful signup
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
      <Button type="submit" variant="contained" color="primary" sx={{ mt: 2, borderRadius: '10px' }}>
        Signup
      </Button>
    </Box>
  );
};

export default Signup;