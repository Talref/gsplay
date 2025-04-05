// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Signup from './components/Signup';
import ListByUsers from './components/ListByUsers';
import YourLibrary from './components/YourLibrary';
import AdminPage from './components/AdminPage';
import Unauthorized from './components/Unauthorized';
import ProtectedRoute from './components/ProtectedRoute';

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
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </Router>
  );
}

export default App;