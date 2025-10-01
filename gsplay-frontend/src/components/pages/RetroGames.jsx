import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import GameOfTheMonthCard from '../composite/GameOfTheMonthCard';
import PageContentEditor from '../composite/PageContentEditor';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const RetroGames = () => {
  const theme = useTheme();
  const [pageText, setPageText] = useLocalStorage('retrogames-page-text', 'RetroAchievements Game of the Month - Coming Soon!');

  const handlePageContentSave = (newContent) => {
    setPageText(newContent);
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      <Navbar />

      <Box sx={{
        padding: 4,
        width: '50%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center'
      }}>
        <Typography variant="retroTitle" sx={{ mb: 3 }}>
          Retrogaming Club
        </Typography>

        {/* Page content editor */}
        <PageContentEditor
          initialContent={pageText}
          onSave={handlePageContentSave}
        />

        {/* Gioco del Mese subtitle */}
        <Typography variant="retroTitleSmall" sx={{ mt: 4 }}>
          Gioco del Mese
        </Typography>

        {/* Game of the Month card */}
        <GameOfTheMonthCard />
      </Box>

      <Footer />
    </Box>
  );
};

export default RetroGames;
