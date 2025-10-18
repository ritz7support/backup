import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Toaster } from './components/ui/sonner';
import './App.css';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import SpaceView from './pages/SpaceView';
import PostDetailPage from './pages/PostDetailPage';
import EventsPage from './pages/EventsPage';
import MembersPage from './pages/MembersPage';
import ProfilePage from './pages/ProfilePage';
import AdminPanel from './pages/AdminPanel';
import DMsPage from './pages/DMsPage';
import PricingPage from './pages/PricingPage';
import PaymentSuccess from './pages/PaymentSuccess';
import JoinViaInvite from './pages/JoinViaInvite';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/space/:spaceId" element={<PrivateRoute><SpaceView /></PrivateRoute>} />
            <Route path="/space/:spaceId/post/:postId" element={<PrivateRoute><PostDetailPage /></PrivateRoute>} />
            <Route path="/events" element={<PrivateRoute><EventsPage /></PrivateRoute>} />
            <Route path="/members" element={<PrivateRoute><MembersPage /></PrivateRoute>} />
            <Route path="/profile/:userId" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/admin/spaces" element={<PrivateRoute><AdminPanel /></PrivateRoute>} />
            <Route path="/dms" element={<PrivateRoute><DMsPage /></PrivateRoute>} />
          </Routes>
          <Toaster />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
