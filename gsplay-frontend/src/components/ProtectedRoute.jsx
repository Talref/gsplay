import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user } = useAuth();

  if (!user) {
    // If the user is not logged in, redirect to the login page
    return <Navigate to="/login" />;
  }

  if (adminOnly && !user.isAdmin) {
    // If the route is admin-only and the user is not an admin, redirect to the unauthorized page
    return <Navigate to="/unauthorized" />;
  }

  // If the user is authorized, render the children
  return children;
};

export default ProtectedRoute;