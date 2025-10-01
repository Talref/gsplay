import React from 'react';
import { Box, Typography } from '@mui/material';
import AchievementBadge from '../ui/AchievementBadge';

const AchievementGallery = ({
  achievements = [],
  title = "Top Achievements",
  maxDisplay = 20,
  badgeSize = 64,
  showScrollbar = true,
  sx = {}
}) => {
  if (!achievements || achievements.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No achievements available
        </Typography>
      </Box>
    );
  }

  // Process achievements with ownership data
  const processedAchievements = achievements
    .map(achievement => ({
      ...achievement,
      totalOwners: (achievement.softcoreOwners?.length || 0) + (achievement.hardcoreOwners?.length || 0)
    }))
    .sort((a, b) => b.totalOwners - a.totalOwners)
    .slice(0, maxDisplay);

  return (
    <Box sx={sx}>
      <Typography variant="retroText" sx={{ mb: 2, textAlign: 'center' }}>
        {title}
      </Typography>

      <Box sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        mt: 3,
        mb: 2,
        pb: 1,
        px: 2,
        ...(showScrollbar && {
          '&::-webkit-scrollbar': {
            height: '10px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'background.default',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'divider',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'secondary.main',
            borderRadius: '8px',
            border: '2px solid',
            borderColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'secondary.dark',
            },
          },
          '&::-webkit-scrollbar-corner': {
            backgroundColor: 'background.paper',
          },
        }),
      }}>
        {processedAchievements.map((achievement) => (
          <AchievementBadge
            key={achievement.achievementId}
            achievement={achievement}
            size={badgeSize}
            showOwners={true}
            showPoints={false}
          />
        ))}
      </Box>
    </Box>
  );
};

export default AchievementGallery;
