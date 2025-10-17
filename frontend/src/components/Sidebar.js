import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Crown, BookOpen, Video, Users, MessageCircle, Lightbulb, HelpCircle } from 'lucide-react';
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
    <div className="w-64 bg-gray-900 text-gray-100 flex flex-col" style={{ height: 'calc(100vh - 64px)' }} data-testid="sidebar">
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-800">
        <img 
          src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/white-blackbackground.png" 
          alt="ABCD Logo" 
          className="h-16 w-16 bg-white rounded-lg p-2 mx-auto"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Welcome & Next Steps */}
        <Link
          to="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/dashboard'
              ? 'bg-purple-600 text-white font-medium'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          data-testid="sidebar-welcome"
        >
          <Lightbulb className="h-5 w-5" />
          <span>Welcome & Next Steps</span>
        </Link>

        {/* Resources & Recordings */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection('resources')}
            className="flex items-center justify-between w-full text-left px-3 py-2.5 hover:bg-gray-800 rounded-lg group transition-colors"
            data-testid="toggle-resources"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Resources & Recordings</span>
            </div>
            {expandedSections.resources ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {expandedSections.resources && (
            <div className="ml-6 space-y-1" data-testid="resources-list">
              {learningSpaces.map((space) => {
                const isActive = isSpaceActive(space.id);
                const isLocked = space.requires_membership && user?.membership_tier === 'free';

                return (
                  <Link
                    key={space.id}
                    to={isLocked ? '/pricing' : `/space/${space.id}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                    data-testid={`sidebar-space-${space.id}`}
                  >
                    <span className="text-lg">{space.icon}</span>
                    <span className="flex-1">{space.name}</span>
                    {isLocked && (
                      <Crown className="h-3.5 w-3.5 text-purple-400" data-testid={`locked-icon-${space.id}`} />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Sessions */}
        <Link
          to="/events"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/events'
              ? 'bg-purple-600 text-white font-medium'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          data-testid="sidebar-events"
        >
          <Video className="h-5 w-5" />
          <span>Live Sessions</span>
        </Link>

        {/* Ask-Doubts */}
        <Link
          to="/space/qa-lounge"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/qa-lounge'
              ? 'bg-purple-600 text-white font-medium'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          data-testid="sidebar-qa"
        >
          <HelpCircle className="h-5 w-5" />
          <span>Ask-Doubts</span>
        </Link>

        {/* Community */}
        <Link
          to="/members"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/members'
              ? 'bg-purple-600 text-white font-medium'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          data-testid="sidebar-community"
        >
          <Users className="h-5 w-5" />
          <span>Community</span>
        </Link>

        {/* Discussions */}
        <Link
          to="/space/general-chat"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === '/space/general-chat'
              ? 'bg-purple-600 text-white font-medium'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          data-testid="sidebar-discussions"
        >
          <MessageCircle className="h-5 w-5" />
          <span>Discussions</span>
        </Link>
      </div>
    </div>
  );
}
