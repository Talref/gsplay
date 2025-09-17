import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, List, ListItem, ListItemText, Box, useTheme } from '@mui/material';
import { gameTitleFormatter } from '../utils/formatters';

// Import platform icons. Make sure these are the correct paths.
import gogIcon from '../assets/gog.png';
import epicIcon from '../assets/epic.png';
import steamIcon from '../assets/steam.png';
import amazonIcon from '../assets/amazon.png';

// Define the platform icons map here so it can be used throughout the component.
const platformIcons = {
  gog: gogIcon,
  epic: epicIcon,
  steam: steamIcon,
  amazon: amazonIcon,
};

const GameDetailsDialog = ({ open, onClose, game }) => {
  const theme = useTheme();

  if (!game) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { minWidth: '40%' },
      }}
    >
      <DialogTitle>{game.name}</DialogTitle>
      <DialogContent>
        {/* IGDB Link */}
        <Typography variant="body1" sx={{ mb: 2 }}>
          <a
            href={`https://www.igdb.com/games/${gameTitleFormatter(game.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.palette.secondary.main }}
          >
            IGDB Page
          </a>
        </Typography>

        {/* List of Owners */}
        <Typography variant="h6" sx={{ mb: 1 }}>
          Proprietari:
        </Typography>
        <List>
          {/* Iterates over the users array to display each owner's name and platform icons. */}
          {game.users.map((user, index) => (
            <ListItem key={index}>
              <ListItemText primary={user.user} />
              <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                {/* Maps through the platforms array for each user to display the corresponding icon. */}
                {user.platform.map((platform, platformIndex) => (
                  <img
                    key={platformIndex}
                    src={platformIcons[platform]}
                    alt={platform}
                    style={{ width: 20, height: 20 }}
                  />
                ))}
              </Box>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GameDetailsDialog;
