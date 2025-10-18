import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Crown, BookOpen, Video, Users, MessageCircle, Lightbulb, HelpCircle, UserPlus, Heart, Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ spaceGroups, spaces }) {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState({
    resources: true
  });

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const isSpaceActive = (spaceId) => {
    return location.pathname === `/space/${spaceId}`;
  };

  // Get the learning spaces (BEGIN, BLAZE, GEN)
  const learningSpaces = spaces.filter(s => 
    s.name === 'BEGIN' || s.name === 'BLAZE' || s.name === 'GEN'
  );

  return (
    <div className="w-64 flex flex-col sticky top-[64px] self-start" style={{ height: 'calc(100vh - 64px)', backgroundColor: '#011328' }} data-testid="sidebar">
      <div className="flex-1 overflow-y-auto p-4 space-y-2 pt-6">
        {/* Welcome & Next Steps */}
        <Link
          to="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/dashboard'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/dashboard' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-welcome"
        >
          <Lightbulb className="h-5 w-5" />
          <span>Welcome & Next Steps</span>
        </Link>

        {/* Introduction */}
        <Link
          to="/space/introductions"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/introductions'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/space/introductions' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-introductions"
        >
          <UserPlus className="h-5 w-5" />
          <span>Introduction</span>
        </Link>

        {/* Resources */}
        <Link
          to="/space/resources"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/resources'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/space/resources' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-resources"
        >
          <BookOpen className="h-5 w-5" />
          <span>Resources</span>
        </Link>

        {/* Events */}
        <Link
          to="/events"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/events'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/events' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-events"
        >
          <Video className="h-5 w-5" />
          <span>Events</span>
        </Link>

        {/* Ask-Doubts */}
        <Link
          to="/space/ask-doubts"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/ask-doubts'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/space/ask-doubts' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-qa"
        >
          <HelpCircle className="h-5 w-5" />
          <span>Ask-Doubts</span>
        </Link>

        {/* Gratitude */}
        <Link
          to="/space/gratitude"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/gratitude'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/space/gratitude' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-gratitude"
        >
          <Heart className="h-5 w-5" />
          <span>Gratitude</span>
        </Link>

        {/* Showcase */}
        <Link
          to="/space/showcase"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/showcase'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/space/showcase' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-showcase"
        >
          <Trophy className="h-5 w-5" />
          <span>Showcase</span>
        </Link>

        {/* Community */}
        <Link
          to="/members"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/members'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/members' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-community"
        >
          <Users className="h-5 w-5" />
          <span>Community</span>
        </Link>

        {/* Discussions */}
        <Link
          to="/space/discussions"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/discussions'
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
          style={location.pathname === '/space/discussions' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          data-testid="sidebar-discussions"
        >
          <MessageCircle className="h-5 w-5" />
          <span>Discussions</span>
        </Link>
      </div>
    </div>
  );
}
