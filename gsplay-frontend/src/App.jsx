// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/pages/Home';
import Login from './components/pages/Login';
import Signup from './components/pages/Signup';
import ListByUsers from './components/pages/ListByUsers';
import YourLibrary from './components/pages/YourLibrary';
import AdminPage from './components/pages/AdminPage';
import GameSearchPage from './components/pages/GameSearchPage';
import Unauthorized from './components/ui/Unauthorized';
import ProtectedRoute from './components/composite/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/list-by-users" element={<ListByUsers />} />
        <Route path="/library" element={
          <ProtectedRoute>
            <YourLibrary />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly={true}>
            <AdminPage />
          </ProtectedRoute>
        } />
        <Route path="/search" element={<GameSearchPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </Router>
  );
}

export default App;
