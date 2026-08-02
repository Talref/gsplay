import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Box, CircularProgress } from '@mui/material'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import Admin from './pages/Admin'
import Auth from './pages/Auth'
import Retro from './pages/Retro'

const Home = lazy(() => import('./pages/Home'))
const Library = lazy(() => import('./pages/Library'))
const Compare = lazy(() => import('./pages/Compare'))
const Catalogue = lazy(() => import('./pages/Catalogue'))
const GameDetail = lazy(() => import('./pages/GameDetail'))
const AdminCatalogue = lazy(() => import('./pages/AdminCatalogue'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const CasualFriday = lazy(() => import('./pages/CasualFriday'))
const CasualFridayManage = lazy(() => import('./pages/CasualFridayManage'))

function protectedPage(page) {
  return <ProtectedRoute>{page}</ProtectedRoute>
}

export default function App() {
  const fallback = (
    <Box sx={{ minHeight: '30vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  )

  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={fallback}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/signup" element={<Auth signup />} />
            <Route path="/library" element={protectedPage(<Library />)} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/catalogue" element={protectedPage(<Catalogue />)} />
            <Route path="/catalogue/:gameId" element={protectedPage(<GameDetail />)} />
            <Route path="/retro" element={protectedPage(<Retro />)} />
            <Route path="/casual-friday" element={protectedPage(<CasualFriday />)} />
            <Route path="/casual-friday/tools" element={protectedPage(<CasualFridayManage />)} />
            <Route path="/admin" element={protectedPage(<Admin />)} />
            <Route path="/admin/users" element={protectedPage(<AdminUsers />)} />
            <Route path="/admin/catalogue" element={protectedPage(<AdminCatalogue />)} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  )
}
