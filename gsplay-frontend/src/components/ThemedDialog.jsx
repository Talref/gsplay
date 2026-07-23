import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

export default function ThemedDialog({ open, onClose, title, children }) {
  return <Dialog open={open} onClose={onClose} aria-labelledby="dialogo-tematizzato-titolo" fullWidth maxWidth="sm" PaperProps={{ sx: { boxShadow: '0 0 28px rgba(127,255,212,.24)', borderColor: 'primary.main' } }}><DialogTitle id="dialogo-tematizzato-titolo" color="primary.main">{title}</DialogTitle><DialogContent dividers>{children}</DialogContent><DialogActions><Button onClick={onClose} autoFocus>Chiudi, annamo</Button></DialogActions></Dialog>;
}