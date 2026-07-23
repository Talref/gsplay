import amazon from '../assets/amazon.png';
import epic from '../assets/epic.png';
import gog from '../assets/gog.png';
import steam from '../assets/steam.png';
import { Chip } from '@mui/material';

const icons = { amazon, epic, gog, steam };

export default function ProviderIcons({ providers = [], size = 20 }) {
  return providers.map((provider) => provider === 'manual' ? <Chip key={provider} label="Manuale" size="small" color="primary" variant="outlined" /> : icons[provider] && <img key={provider} src={icons[provider]} alt={`Su ${provider}`} title={provider} style={{ width: size, height: size, objectFit: 'contain', flex: '0 0 auto' }} />);
}