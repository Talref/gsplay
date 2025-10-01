import React from 'react';
import { Box, Typography } from '@mui/material';

const AchievementBadge = ({
  achievement,
  size = 64,
  showPoints = true,
  showOwners = true,
  title = true,
  sx = {}
}) => {
  const totalOwners = (achievement.softcoreOwners?.length || 0) + (achievement.hardcoreOwners?.length || 0);

  return (
    <Box
      sx={{
        position: 'relative',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 1,
        overflow: 'hidden',
        border: `2px solid ${totalOwners > 0 ? 'secondary.main' : 'divider'}`,
        transition: 'all 0.2s ease',
        cursor: title ? 'pointer' : 'default',
        filter: totalOwners === 0 ? 'grayscale(100%) opacity(0.4)' : 'none',
        '&:hover': {
          transform: title ? 'scale(1.1)' : 'none',
          filter: totalOwners === 0 ? 'grayscale(100%) opacity(0.6)' : 'brightness(1.1)',
          zIndex: 10,
        },
        ...sx
      }}
      title={title ? `${achievement.name} (${achievement.points} points) - Owned by ${totalOwners} players` : undefined}
    >
      <Box
        component="img"
        src={`https://retroachievements.org/Badge/${achievement.badgeId}.png`}
        alt={achievement.name}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        onError={(e) => {
          e.target.src = '/placeholder-game.jpg';
        }}
      />

      {/* Ownership indicator */}
      {showOwners && totalOwners > 0 && (
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          fontSize: `${Math.max(10, size * 0.15)}px`,
          fontWeight: 'bold',
          px: 0.5,
          py: 0.2,
          borderRadius: '4px 0 0 0',
          fontFamily: 'RetroGaming8Bit, monospace',
        }}>
          {totalOwners}
        </Box>
      )}

      {/* Points indicator */}
      {showPoints && achievement.points && (
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          fontSize: `${Math.max(8, size * 0.12)}px`,
          fontWeight: 'bold',
          px: 0.3,
          py: 0.1,
          borderRadius: '2px 0 0 0',
          fontFamily: 'RetroGaming8Bit, monospace',
        }}>
          {achievement.points}
        </Box>
      )}
    </Box>
  );
};

export default AchievementBadge;
