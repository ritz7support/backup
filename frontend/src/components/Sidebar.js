import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Crown, Lightbulb } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ spaceGroups, spaces }) {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState({});

  // Initialize expanded state for all groups
  useEffect(() => {
    if (spaceGroups && spaceGroups.length > 0) {
      const initialExpanded = {};
      spaceGroups.forEach(group => {
        initialExpanded[group.id] = true; // All groups expanded by default
      });
      setExpandedSections(initialExpanded);
    }
  }, [spaceGroups]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const isSpaceActive = (spaceId) => {
    return location.pathname === `/space/${spaceId}` || location.pathname.startsWith(`/space/${spaceId}/`);
  };

  // Group spaces by their space_group_id
  const getSpacesByGroup = (groupId) => {
    return spaces.filter(s => s.space_group_id === groupId).sort((a, b) => a.order - b.order);
  };

  // Get standalone spaces (no group)
  const standaloneSpaces = spaces.filter(s => !s.space_group_id).sort((a, b) => a.order - b.order);

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

        {/* Standalone Spaces (no group) */}
        {standaloneSpaces.map((space) => {
          const isActive = isSpaceActive(space.id);
          const isLocked = space.requires_payment && user?.membership_tier === 'free';

          return (
            <Link
              key={space.id}
              to={isLocked ? '/pricing' : `/space/${space.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'text-white font-medium'
                  : 'text-gray-300 hover:text-white'
              }`}
              style={isActive ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
              data-testid={`sidebar-space-${space.id}`}
            >
              <span className="text-lg">{space.icon || '💬'}</span>
              <span className="flex-1">{space.name}</span>
              {isLocked && (
                <Crown className="h-3.5 w-3.5" style={{ color: '#FFB91A' }} data-testid={`locked-icon-${space.id}`} />
              )}
            </Link>
          );
        })}

        {/* Space Groups with Spaces */}
        {spaceGroups.sort((a, b) => a.order - b.order).map((group) => {
          const groupSpaces = getSpacesByGroup(group.id);
          if (groupSpaces.length === 0) return null;

          return (
            <div key={group.id} className="space-y-1">
              <button
                onClick={() => toggleSection(group.id)}
                className="flex items-center justify-between w-full text-left px-3 py-2.5 rounded-lg group transition-colors text-gray-300 hover:text-white"
                style={{ backgroundColor: 'transparent' }}
                data-testid={`toggle-${group.id}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{group.icon || '📁'}</span>
                  <span className="text-sm font-medium">{group.name}</span>
                </div>
                {expandedSections[group.id] ? (
                  <ChevronDown className="h-4 w-4" style={{ color: '#8CB7E7' }} />
                ) : (
                  <ChevronRight className="h-4 w-4" style={{ color: '#8CB7E7' }} />
                )}
              </button>

              {expandedSections[group.id] && (
                <div className="ml-6 space-y-1" data-testid={`group-spaces-${group.id}`}>
                  {groupSpaces.map((space) => {
                    const isActive = isSpaceActive(space.id);
                    const isLocked = space.requires_payment && user?.membership_tier === 'free';

                    return (
                      <Link
                        key={space.id}
                        to={isLocked ? '/pricing' : `/space/${space.id}`}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'text-white font-medium'
                            : 'text-gray-300 hover:text-white'
                        }`}
                        style={isActive ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
                        data-testid={`sidebar-space-${space.id}`}
                      >
                        <span className="text-lg">{space.icon || '💬'}</span>
                        <span className="flex-1">{space.name}</span>
                        {isLocked && (
                          <Crown className="h-3.5 w-3.5" style={{ color: '#FFB91A' }} data-testid={`locked-icon-${space.id}`} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
