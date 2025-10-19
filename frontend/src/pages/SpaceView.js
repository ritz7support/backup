import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import SpaceFeed from '../components/SpaceFeed';
import EventsCalendar from '../components/EventsCalendar';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { spacesAPI } from '../lib/api';

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
      <Header />

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
