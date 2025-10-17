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
import {
  Sparkles,
  Home,
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

  const getSpacesByGroup = (groupId) => {
    return spaces.filter((s) => s.space_group_id === groupId);
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="dashboard">
      {/* Top Navigation */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-purple-600" />
              <span className="text-2xl font-bold gradient-text">ABCD</span>
            </Link>

            <nav className="hidden md:flex gap-6">
              <Link to="/dashboard" className="text-gray-700 hover:text-purple-600 font-medium" data-testid="nav-home">
                <Home className="h-5 w-5 inline mr-1" />
                Home
              </Link>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
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
          <div className="space-y-8">
            {spaceGroups.map((group) => {
              const groupSpaces = getSpacesByGroup(group.id);
              if (groupSpaces.length === 0) return null;

              return (
                <div key={group.id} className="bg-white rounded-2xl p-6 shadow-sm" data-testid={`space-group-${group.id}`}>
                  <h2 className="text-2xl font-bold mb-4">{group.name}</h2>
                  {group.description && (
                    <p className="text-gray-600 mb-6">{group.description}</p>
                  )}

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupSpaces.map((space) => (
                      <Link
                        key={space.id}
                        to={`/space/${space.id}`}
                        className="p-6 border rounded-xl hover:border-purple-600 hover:shadow-md transition-all"
                        data-testid={`space-card-${space.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-3xl">{space.icon || '📁'}</div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{space.name}</h3>
                            {space.description && (
                              <p className="text-sm text-gray-600">{space.description}</p>
                            )}
                            {space.requires_membership && user?.membership_tier === 'free' && (
                              <div className="inline-flex items-center gap-1 mt-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                <Crown className="h-3 w-3" />
                                Premium
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upgrade Banner for Free Users */}
        {user?.membership_tier === 'free' && (
          <div className="mt-8 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl p-8 border border-purple-200" data-testid="upgrade-banner">
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
    </div>
  );
}
