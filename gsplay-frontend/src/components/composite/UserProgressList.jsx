import React from 'react';
import { Box, Typography } from '@mui/material';
import ProgressBar from '../ui/ProgressBar';

const UserProgressList = ({
  users = [],
  title = "User Progress",
  variant = "completion", // "completion" or "points"
  showAchievements = false,
  maxUsers = 10,
  sx = {}
}) => {
  if (!users || users.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No player data available
        </Typography>
      </Box>
    );
  }

  // Sort users based on variant
  const sortedUsers = users
    .sort((a, b) => {
      if (variant === "completion") {
        return (b.completionPercentage || 0) - (a.completionPercentage || 0);
      } else {
        return (b.totalPoints || 0) - (a.totalPoints || 0);
      }
    })
    .slice(0, maxUsers);

  return (
    <Box sx={sx}>
      <Typography variant="retroText" sx={{ textAlign: 'center', mb: 2 }}>
        {title}
      </Typography>

      <Box sx={{ mt: 3 }}>
        {sortedUsers.map((user, index) => {
          // Get user's earned achievements if needed
          const userAchievements = showAchievements && users.length > 0 ?
            users.find(u => u.userId === user.userId)?.achievements?.filter(achievement =>
              achievement.softcoreOwners?.includes(user.userId) ||
              achievement.hardcoreOwners?.includes(user.userId)
            ).sort((a, b) => b.points - a.points) || [] : [];

          return (
            <Box key={user.userId} sx={{ mb: showAchievements ? 3 : 2, ml: 3, mr: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="retroTextSmall" sx={{ minWidth: '30px', fontWeight: 'bold', color: 'text.primary' }}>
                  #{index + 1} {user.username}
                </Typography>
                <Typography variant="retroTextSmall" sx={{ flex: 1, minWidth: '60px', textAlign: 'right', fontWeight: 'bold' }}>
                  {variant === "completion"
                    ? `${user.completionPercentage || 0}%`
                    : `${user.totalPoints || 0} pts`
                  }
                </Typography>
              </Box>

              <ProgressBar
                value={variant === "completion"
                  ? (user.completionPercentage || 0)
                  : Math.min((user.totalPoints || 0), 100) // Cap at 100% for visual
                }
                height={variant === "completion" ? 8 : 6}
                showPercentage={false}
              />

              {/* User's achievements (for points variant) */}
              {showAchievements && userAchievements.length > 0 && (
                <Box sx={{
                  display: 'flex',
                  gap: 0.5,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  pb: 1,
                  mt: 1,
                  '&::-webkit-scrollbar': {
                    height: '6px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'background.default',
                    borderRadius: '3px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'secondary.main',
                    borderRadius: '3px',
                  },
                }}>
                  {userAchievements.map((achievement) => (
                    <Box
                      key={achievement.achievementId}
                      sx={{
                        position: 'relative',
                        flexShrink: 0,
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'secondary.main',
                      }}
                      title={`${achievement.name} (${achievement.points} points)`}
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
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        fontSize: '0.6rem',
                        fontWeight: 'bold',
                        px: 0.3,
                        py: 0.1,
                        borderRadius: '2px 0 0 0',
                        fontFamily: 'RetroGaming8Bit, monospace',
                      }}>
                        {achievement.points}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {showAchievements && userAchievements.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', mt: 1 }}>
                  No achievements earned yet
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default UserProgressList;
