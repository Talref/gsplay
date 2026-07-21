import amazon from '../assets/amazon.png';
import epic from '../assets/epic.png';
import gog from '../assets/gog.png';
import steam from '../assets/steam.png';

const icons = { amazon, epic, gog, steam };

export default function ProviderIcons({ providers = [] }) {
  return providers.map((provider) => icons[provider] && <img key={provider} src={icons[provider]} alt={provider} title={provider} style={{ maxWidth: 20, maxHeight: 20, objectFit: 'contain' }} />);
}