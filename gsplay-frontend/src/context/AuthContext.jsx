// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../services/api'; // Rename the imported login function

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Fetch user data if token exists
      // For now, set a placeholder user
      setUser({ name: 'LoggedInUser' }); // Replace this with actual user data
    }
  }, []);

  const loginUser = async (credentials) => { // Rename the function to avoid shadowing
    try {
      const data = await apiLogin(credentials); // Use the renamed API login function
      localStorage.setItem('token', data.token); // Save the token to localStorage
      setUser({ name: credentials.name }); // Update the user state
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logoutUser = () => { // Rename for consistency
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login: loginUser, logout: logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);