import { useState, useEffect, createContext, useContext } from 'react';
import { authAPI } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    handleSessionFromURL();
  }, []);

  const handleSessionFromURL = async () => {
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1].split('&')[0];
      setLoading(true);
      try {
        await authAPI.processSession(sessionId);
        window.history.replaceState({}, document.title, window.location.pathname);
        await checkAuth();
      } catch (error) {
        console.error('Session processing error:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const checkAuth = async () => {
    try {
      const { data } = await authAPI.getMe();
      setUser(data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    setUser(data.user);
    return data;
  };

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    setUser(data.user);
    return data;
  };

  const loginWithGoogle = async () => {
    return new Promise((resolve, reject) => {
      // Initialize Google Sign-In
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: '682614969210-ljsimr1oabmnno484u3fu7nba4ai2bnp.apps.googleusercontent.com',
          callback: async (response) => {
            try {
              const { data } = await authAPI.googleLogin(response.credential);
              setUser(data.user);
              resolve(data);
            } catch (error) {
              reject(error);
            }
          }
        });
        
        // Trigger the One Tap UI or render button
        window.google.accounts.id.prompt();
      } else {
        reject(new Error('Google Sign-In not loaded'));
      }
    });
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, loginWithGoogle, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
