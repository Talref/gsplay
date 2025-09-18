import { ListItem, ListItemText, Box, useTheme } from '@mui/material';

// Import platform icons.
import gogIcon from '../../assets/gog.png';
import epicIcon from '../../assets/epic.png';
import steamIcon from '../../assets/steam.png';
import amazonIcon from '../../assets/amazon.png';

// Define the platform icons map here so it can be used throughout the component.
const platformIcons = {
  gog: gogIcon,
  epic: epicIcon,
  steam: steamIcon,
  amazon: amazonIcon,
};

const UserGameListItem = ({ game, onClick }) => {
  const theme = useTheme();

  const handleItemClick = () => {
    onClick(game.name);
  };

  return (
    <ListItem
      key={`${game.name}-${game.platform}`}
      onClick={handleItemClick}
      sx={{
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: theme.palette.primary.light,
        },
      }}
    >
      <ListItemText primary={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {game.name}
          {game.platform && (
            <img
              src={platformIcons[game.platform]}
              alt={game.platform}
              style={{ width: 20, height: 20 }}
            />
          )}
        </span>
      }
      />
    </ListItem>
  );
};

export default UserGameListItem;
