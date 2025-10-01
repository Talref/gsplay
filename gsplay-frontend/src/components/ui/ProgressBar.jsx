import React from 'react';
import { LinearProgress, Typography, Box } from '@mui/material';

const ProgressBar = ({
  value,
  label,
  showPercentage = true,
  height = 8,
  color = 'secondary.main',
  backgroundColor = 'background.default',
  borderRadius = 4,
  sx = {}
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
      {label && (
        <Typography variant="body2" sx={{ minWidth: 'fit-content' }}>
          {label}
        </Typography>
      )}
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={value}
          sx={{
            height,
            borderRadius,
            backgroundColor,
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
              borderRadius,
            },
          }}
        />
      </Box>
      {showPercentage && (
        <Typography variant="body2" sx={{ minWidth: '40px', textAlign: 'right' }}>
          {Math.round(value)}%
        </Typography>
      )}
    </Box>
  );
};

export default ProgressBar;
