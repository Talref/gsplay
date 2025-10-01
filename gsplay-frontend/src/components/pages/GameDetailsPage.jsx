import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import GameDetailView from '../composite/GameDetailView';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';

const GameDetailsPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const handleBackToSearch = () => {
    navigate('/search');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box sx={{ flexGrow: 1 }}>
        <GameDetailView
          gameId={gameId}
          onBack={handleBackToSearch}
        />
      </Box>
      <Footer />
    </Box>
  );
};

export default GameDetailsPage;
