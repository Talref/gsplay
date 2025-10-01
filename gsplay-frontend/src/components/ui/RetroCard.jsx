import React from 'react';
import { Box, Paper } from '@mui/material';

const RetroCard = ({
  children,
  variant = 'default', // 'default' or 'gom' (Game of the Month)
  sx = {},
  ...props
}) => {
  const baseStyles = {
    borderRadius: variant === 'gom' ? 3 : 1,
    border: `2px solid ${variant === 'gom' ? 'secondary.main' : 'divider'}`,
    backgroundColor: 'background.paper',
    overflow: 'hidden',
    ...sx
  };

  if (variant === 'gom') {
    return (
      <Box sx={baseStyles} {...props}>
        {children}
      </Box>
    );
  }

  return (
    <Paper sx={baseStyles} {...props}>
      {children}
    </Paper>
  );
};

export default RetroCard;
