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

  // Fetch user data (no token needed - cookies are automatic)
  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include', // Required for cookies
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null); // Clear user if request fails
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
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
      await apiLogout(); // Clears cookies via backend
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