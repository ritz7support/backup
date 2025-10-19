import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import SpaceFeed from '../components/SpaceFeed';
import EventsCalendar from '../components/EventsCalendar';
import Header from '../components/Header';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Home, Users, MessageCircle, Bell, LogOut, Crown, Settings, Loader2 } from 'lucide-react';
import { spacesAPI } from '../lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export default function SpaceView() {
  const { spaceId } = useParams();
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
      console.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getSpaceTitle = () => {
    const titles = {
      'introductions': 'Introduction',
      'ask-doubts': 'Ask-Doubts',
      'gratitude': 'Gratitude',
      'showcase': 'Showcase',
      'discussions': 'Discussions',
      'resources': 'Resources'
    };
    return titles[spaceId] || 'Space';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
      </div>
    );
  }

  // Render content based on space type
  const renderSpaceContent = () => {
    // Find the current space
    const currentSpace = spaces.find(s => s.id === spaceId);
    
    if (!currentSpace) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: '#011328' }}>Space Not Found</h2>
            <p style={{ color: '#8E8E8E' }}>This space doesn't exist or you don't have access.</p>
          </div>
        </div>
      );
    }
    
    const spaceType = currentSpace.space_type || 'post';
    
    // Render based on space type
    switch(spaceType) {
      case 'event':
        // Events type shows embedded calendar
        return <EventsCalendar spaceId={spaceId} />;
        
      case 'qa':
        // Q&A type - pass flag to SpaceFeed for different layout
        return <SpaceFeed spaceId={spaceId} isQAMode={true} />;
        
      case 'post':
      case 'announcement':
      case 'resource':
      default:
        // Post, announcement, and resource types use standard feed
        return <SpaceFeed spaceId={spaceId} isQAMode={false} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F3F4F6' }}>
      {/* Top Navigation */}
      <header className="border-b sticky top-0 z-50" style={{ backgroundColor: '#011328', borderColor: '#022955' }}>
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/dashboard">
              <img 
                src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/2ftx37lf_white-blackbackground.png" 
                alt="ABCD" 
                className="h-10 w-10"
              />
            </Link>
          </div>

          <nav className="flex gap-8">
            <Link to="/dashboard" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors">
              <Home className="h-5 w-5" />
              Home
            </Link>
            <Link to="/members" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors">
              <Users className="h-5 w-5" />
              Members
            </Link>
            <Link to="/dms" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors">
              <MessageCircle className="h-5 w-5" />
              Messages
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white" style={{ backgroundColor: 'transparent' }}>
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-gray-300 hover:text-white" style={{ backgroundColor: 'transparent' }}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.picture} />
                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>{user?.name?.[0]}</AvatarFallback>
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
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/profile/${user?.id}`)}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin/spaces')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Spaces
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        <Sidebar spaceGroups={spaceGroups} spaces={spaces} />
        <main className="flex-1 overflow-y-auto">
          {renderSpaceContent()}
        </main>
      </div>
    </div>
  );
}
