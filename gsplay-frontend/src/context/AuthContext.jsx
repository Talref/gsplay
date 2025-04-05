//src/context/authContext.js
import React, { createContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Check for user on initial load
  useEffect(() => {
    fetchUserData();
  }, []);

// Modify fetchUserData to handle public pages gracefully
const fetchUserData = async () => {
  try {
    const response = await fetch('/api/users/me', {
      credentials: 'include',
    });
    
    if (response.status === 401) {
      // Expected for public pages - user isn't logged in
      setUser(null);
      return;
    }
    
    if (!response.ok) throw new Error('Failed to fetch user');
    
    const userData = await response.json();
    setUser(userData);
  } catch (error) {
    console.error('User fetch error:', error);
    setUser(null);
  }
};

  // Login function
  const loginUser = async (credentials) => {
    try {
      await apiLogin(credentials); // Cookies set by backend
      await fetchUserData(); // Fetch user data after login
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Logout function
  const logoutUser = async () => {
    try {
      await apiLogout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login: loginUser, logout: logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);