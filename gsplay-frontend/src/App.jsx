// src/App.jsx
import React from 'react';
import { AppBar, Toolbar, Typography, Button, Container, Box, Link } from '@mui/material';

function App() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh', // Full viewport height
        backgroundColor: 'background.default', // Dark background
        color: 'text.primary', // White text
      }}
    >
      {/* Navbar */}
      <AppBar position="static" sx={{ backgroundColor: 'primary.main' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            GSplay
          </Typography>
          <Link href="#" color="inherit" sx={{ mx: 2 }}>Home</Link>
          <Link href="#" color="inherit" sx={{ mx: 2 }}>About</Link>
          <Link href="#" color="inherit" sx={{ mx: 2 }}>Contact</Link>
        </Toolbar>
      </AppBar>

      {/* Body */}
      <Container maxWidth="md" sx={{ py: 4, flex: 1 }}>
        <Typography variant="h2" gutterBottom sx={{ color: 'secondary.main' }}>
          Welcome to GSplay
        </Typography>
        <Typography variant="body1" paragraph>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </Typography>
        <Button variant="contained" color="secondary">
          Example Button
        </Button>
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          backgroundColor: 'primary.main',
          color: 'text.primary',
          textAlign: 'center',
        }}
      >
        <Typography variant="body1">
          Made with <span role="img" aria-label="heart">❤️</span> and AI
        </Typography>
      </Box>
    </Box>
  );
}

export default App;