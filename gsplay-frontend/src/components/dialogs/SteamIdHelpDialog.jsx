import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Box, Link, Typography, useTheme } from '@mui/material';

const SteamIdHelpDialog = ({ open, onClose }) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
        }
      }}
    >
      <DialogTitle>Come trovare lo SteamID</DialogTitle>
      <DialogContent>
        <DialogContentText component="div" sx={{ color: theme.palette.text.primary }}>
          Per Trovare il tuo steamID:
          <Box component="ol" sx={{
            pl: 4, // Increased left padding for indentation
            '& li': {
              mb: 1.5, // Increased margin bottom for each list item
              lineHeight: 1.6, // Increased line height
            }
          }}>
            <li>Visita il tuo <Link href="https://steamcommunity.com/my/" target="_blank" rel="noopener">profilo Steam</Link> (log in se necessario)</li>
            <li>Il tuo SteamID sono le ultime 17 cifre dell'URL</li>
            <li>Se il tuo profilo steam non finisce con lo SteamID visita <Link href="https://steamid.io/" target="_blank" rel="noopener">SteamID.io</Link> ed incolla il link del tuo profilo</li>
            <li>SteamID.io calcolera' il tuo SteamID dal link (quello corretto e' SteamID64).</li>
            <li>Inserisci il tuo SteamID nel form di questa pagina</li>
            <li>ATTENZIONE: La tua lista di giochi dev'essere PUBBLICA sul tuo profilo Steam! Altrimenti l'app non puo' leggerla!</li>
          </Box>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Non c'e' bisogno di ripetere questa operazione. Se aggiungete nuovi giochi alla vostra libreria basta cliccare su Aggiorna Libreria.
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          variant="default"
        >
          Chiudi
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SteamIdHelpDialog;
