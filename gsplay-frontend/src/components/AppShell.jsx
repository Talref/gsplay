import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import GamesOutlinedIcon from '@mui/icons-material/GamesOutlined'
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined'
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined'
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined'
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined'
import { useAuth } from '../context/useAuth'

const memberLinks = [
  ['Home', '/', <HomeOutlinedIcon key="home" color="primary" />],
  ['Libreria', '/library', <GamesOutlinedIcon key="library" color="primary" />],
  ['Confronta', '/compare', <CompareArrowsOutlinedIcon key="compare" color="primary" />],
  ['Catalogo', '/catalogue', <TravelExploreOutlinedIcon key="catalogue" color="primary" />],
  [
    'Casual Friday',
    '/casual-friday',
    <CelebrationOutlinedIcon key="casual-friday" color="primary" />
  ],
  ['Retroclub', '/retro', <SportsEsportsOutlinedIcon key="retro" color="primary" />]
]

function Navigation({ user, pathname, closeDrawer }) {
  const visibleLinks = memberLinks.filter(
    ([, to]) => user || !['/library', '/casual-friday'].includes(to)
  )

  return (
    <List sx={{ p: 1 }}>
      {visibleLinks.map(([label, to, icon]) => (
        <ListItemButton
          key={to}
          component={Link}
          to={to}
          selected={pathname === to}
          onClick={closeDrawer}
        >
          <Box sx={{ display: 'inline-flex', mr: 1.5 }}>{icon}</Box>
          <ListItemText primary={label} />
        </ListItemButton>
      ))}
      {user?.role === 'admin' && (
        <>
          <ListItemButton component={Link} to="/admin" selected={pathname === '/admin'}>
            <ListItemText primary="Amministrazione" />
          </ListItemButton>
          <ListItemButton
            component={Link}
            to="/admin/catalogue"
            selected={pathname === '/admin/catalogue'}
          >
            <ListItemText primary="Catalogo admin" />
          </ListItemButton>
        </>
      )}
      {['helper', 'admin'].includes(user?.role) && (
        <ListItemButton
          component={Link}
          to="/casual-friday/tools"
          selected={pathname === '/casual-friday/tools'}
          onClick={closeDrawer}
        >
          <ListItemText primary="Casual Friday Tools" />
        </ListItemButton>
      )}
    </List>
  )
}

export default function AppShell({ children }) {
  const { user, loading, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label="Caricamento applicazione" />
      </Box>
    )
  }

  const navigation = (
    <Navigation user={user} pathname={pathname} closeDrawer={() => setDrawerOpen(false)} />
  )

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{ backdropFilter: 'blur(14px)', borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar>
          <IconButton
            aria-label="Apri navigazione"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { md: 'none' }, mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
          <Stack
            component={Link}
            to="/"
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ flexGrow: 1, color: 'primary.main', textDecoration: 'none' }}
          >
            <Box
              component="img"
              src="/gslogo.png"
              alt="GSplay"
              sx={{ width: 32, height: 32, objectFit: 'contain' }}
            />
            <Typography
              className="pixel-label"
              sx={{
                fontSize: 'clamp(.9rem, 1.7vw, 1.15rem)',
                fontWeight: 900,
                color: 'primary.main',
                letterSpacing: '.11em'
              }}
            >
              GSPLAY
            </Typography>
          </Stack>
          {user ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ display: { xs: 'none', sm: 'block' } }}>{user.username}</Typography>
              <Button color="inherit" onClick={logout}>
                Esci
              </Button>
            </Stack>
          ) : (
            <Button component={Link} to="/login" variant="contained">
              Entra, su
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ pt: 8, width: 240 }}>{navigation}</Box>
      </Drawer>
      <Box sx={{ display: 'flex' }}>
        <Box
          component="aside"
          sx={{
            width: 220,
            borderRight: 1,
            borderColor: 'divider',
            display: { xs: 'none', md: 'block' },
            minHeight: 'calc(100vh - 65px)'
          }}
        >
          {navigation}
        </Box>
        <Container component="main" maxWidth="xl" sx={{ flexGrow: 1, py: { xs: 3, md: 5 } }}>
          {children}
        </Container>
      </Box>
    </Box>
  )
}
