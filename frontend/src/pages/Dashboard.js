import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { spacesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
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
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [spaceGroups, setSpaceGroups] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpaces();
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

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="dashboard">
      {/* Top Navigation */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-purple-600" />
              <span className="text-2xl font-bold gradient-text">ABCD</span>
            </Link>

            <nav className="hidden md:flex gap-6">
              <Link to="/events" className="text-gray-700 hover:text-purple-600 font-medium" data-testid="nav-events">
                <Calendar className="h-5 w-5 inline mr-1" />
                Events
              </Link>
              <Link to="/members" className="text-gray-700 hover:text-purple-600 font-medium" data-testid="nav-members">
                <Users className="h-5 w-5 inline mr-1" />
                Members
              </Link>
              <Link to="/dms" className="text-gray-700 hover:text-purple-600 font-medium" data-testid="nav-dms">
                <MessageCircle className="h-5 w-5 inline mr-1" />
                Messages
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" data-testid="notifications-btn">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu-trigger">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.picture} />
                    <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  {user?.is_founding_member && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-purple-600">
                      <Crown className="h-3 w-3" />
                      Founding Member
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1 capitalize">
                    {user?.membership_tier} Plan
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/profile/${user?.id}`)} data-testid="menu-profile">
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pricing')} data-testid="menu-upgrade">
                  Upgrade Plan
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {!loading && (
          <Sidebar spaceGroups={spaceGroups} spaces={spaces} />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 text-white mb-8" data-testid="welcome-banner">
              <h1 className="text-3xl font-bold mb-2">
                Welcome back, {user?.name?.split(' ')[0]}! 👋
              </h1>
              <p className="text-purple-100 text-lg">
                Continue your no-code journey with the ABCD community
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Quick Start Section */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
                  <p className="text-gray-600 mb-4">
                    Choose a learning path from the sidebar to get started, or explore community discussions.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-xl hover:border-purple-600 transition-colors">
                      <div className="text-2xl mb-2">🚀</div>
                      <h3 className="font-semibold mb-1">Start Learning</h3>
                      <p className="text-sm text-gray-600">Begin with Bubble.io basics</p>
                    </div>
                    <div className="p-4 border rounded-xl hover:border-purple-600 transition-colors">
                      <div className="text-2xl mb-2">💬</div>
                      <h3 className="font-semibold mb-1">Join Discussions</h3>
                      <p className="text-sm text-gray-600">Connect with the community</p>
                    </div>
                    <div className="p-4 border rounded-xl hover:border-purple-600 transition-colors">
                      <div className="text-2xl mb-2">📅</div>
                      <h3 className="font-semibold mb-1">Attend Events</h3>
                      <p className="text-sm text-gray-600">Join live sessions & Q&As</p>
                    </div>
                  </div>
                </div>

                {/* Upgrade Banner for Free Users */}
                {user?.membership_tier === 'free' && (
                  <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl p-8 border border-purple-200" data-testid="upgrade-banner">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Unlock Premium Features</h3>
                        <p className="text-gray-700">
                          Get access to all learning spaces, live sessions, and exclusive community perks.
                        </p>
                      </div>
                      <Link to="/pricing">
                        <Button className="bg-gradient-to-r from-purple-600 to-indigo-600" data-testid="upgrade-btn">
                          Upgrade Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
