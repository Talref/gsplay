// src/components/Home.jsx
import React from 'react';
import { Box, useTheme } from '@mui/material'; // 
import Navbar from './Navbar';
import Footer from './Footer';

const Home = () => {
  const theme = useTheme(); 

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        {/* Add your main content here later */}
      </Box>
      <Footer />
    </Box>
  );
};

export default Home;