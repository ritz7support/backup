import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { spacesAPI, subscriptionStatusAPI } from '../lib/api';
import Header from '../components/Header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import Sidebar from '../components/Sidebar';
import {
  Sparkles,
  Calendar,
  Users,
  MessageCircle,
  Settings,
  LogOut,
  Bell,
  Crown,
  Loader2,
  Home,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [spaceGroups, setSpaceGroups] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  useEffect(() => {
    loadSpaces();
    checkSubscriptionStatus();
  }, []);

  const loadSpaces = async () => {
    try {
      const [groupsRes, spacesRes] = await Promise.all([
        spacesAPI.getSpaceGroups(),
        spacesAPI.getSpaces(),
      ]);
      setSpaceGroups(groupsRes.data);
      setSpaces(spacesRes.data);
    } catch (error) {
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };


  const checkSubscriptionStatus = async () => {
    try {
      const { data } = await subscriptionStatusAPI.getMyStatus();
      setSubscriptionStatus(data);
      
      // If payment is required and user doesn't have subscription (and is not admin)
      if (data.requires_payment && !data.has_subscription && !data.is_admin) {
        toast.error('Subscription required to access the community');
        navigate('/pricing');
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };


  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="dashboard">
      <Header />

      {/* Main Layout with Sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        {!loading && (
          <Sidebar spaceGroups={spaceGroups} spaces={spaces} />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F3F4F6' }}>
          {children ? (
            children
          ) : (
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Welcome Banner */}
            <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm border" style={{ borderColor: '#D1D5DB' }} data-testid="welcome-banner">
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#011328' }}>
                Welcome back, {user?.name?.split(' ')[0]}! 👋
              </h1>
              <p className="text-lg" style={{ color: '#3B3B3B' }}>
                Continue your no-code journey with the ABCD community
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Quick Start Section */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
                  <h2 className="text-2xl font-bold mb-4" style={{ color: '#011328' }}>Quick Start</h2>
                  <p className="mb-6" style={{ color: '#3B3B3B' }}>
                    Choose a learning path from the sidebar to get started, or explore community discussions.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-xl transition-all cursor-pointer border" style={{ backgroundColor: '#E6EFFA', borderColor: '#5796DC' }}>
                      <div className="text-3xl mb-3">🚀</div>
                      <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Start Learning</h3>
                      <p className="text-sm" style={{ color: '#3B3B3B' }}>Begin with Bubble.io basics</p>
                    </div>
                    <div className="p-6 rounded-xl transition-all cursor-pointer border" style={{ backgroundColor: '#E6EFFA', borderColor: '#5796DC' }}>
                      <div className="text-3xl mb-3">💬</div>
                      <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Join Discussions</h3>
                      <p className="text-sm" style={{ color: '#3B3B3B' }}>Connect with the community</p>
                    </div>
                    <div className="p-6 rounded-xl transition-all cursor-pointer border" style={{ backgroundColor: '#E6EFFA', borderColor: '#5796DC' }}>
                      <div className="text-3xl mb-3">📅</div>
                      <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Attend Events</h3>
                      <p className="text-sm" style={{ color: '#3B3B3B' }}>Join live sessions & Q&As</p>
                    </div>
                  </div>
                </div>

                {/* Upgrade Banner for Free Users */}
                {user?.membership_tier === 'free' && (
                  <div className="rounded-2xl p-8 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }} data-testid="upgrade-banner">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Unlock Premium Features</h3>
                        <p style={{ color: '#E6EFFA' }}>
                          Get access to all learning spaces, live sessions, and exclusive community perks.
                        </p>
                      </div>
                      <Link to="/pricing">
                        <Button className="font-medium" style={{ backgroundColor: '#FFB91A', color: '#011328' }} data-testid="upgrade-btn">
                          Upgrade Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
