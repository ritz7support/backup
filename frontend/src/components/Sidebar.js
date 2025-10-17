import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ spaceGroups, spaces }) {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState(
    spaceGroups.reduce((acc, group) => ({ ...acc, [group.id]: true }), {})
  );

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getSpacesByGroup = (groupId) => {
    return spaces.filter(s => s.space_group_id === groupId);
  };

  const isSpaceActive = (spaceId) => {
    return location.pathname === `/space/${spaceId}`;
  };

  return (
    <div className="w-64 bg-gray-900 text-gray-100 h-full overflow-y-auto" data-testid="sidebar">
      <div className="p-4 space-y-6">
        {spaceGroups.map((group) => {
          const groupSpaces = getSpacesByGroup(group.id);
          if (groupSpaces.length === 0) return null;

          return (
            <div key={group.id} className="space-y-1" data-testid={`sidebar-group-${group.id}`}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="flex items-center justify-between w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded-lg group"
                data-testid={`toggle-group-${group.id}`}
              >
                <div className="flex items-center gap-2">
                  {expandedGroups[group.id] ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm font-semibold text-gray-700">{group.name}</span>
                </div>
              </button>

              {expandedGroups[group.id] && (
                <div className="ml-2 space-y-0.5" data-testid={`spaces-for-${group.id}`}>
                  {groupSpaces.map((space) => {
                    const isActive = isSpaceActive(space.id);
                    const isLocked = space.requires_membership && user?.membership_tier === 'free';

                    return (
                      <Link
                        key={space.id}
                        to={isLocked ? '/pricing' : `/space/${space.id}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-purple-50 text-purple-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        data-testid={`sidebar-space-${space.id}`}
                      >
                        <span className="text-lg">{space.icon || '📁'}</span>
                        <span className="flex-1">{space.name}</span>
                        {isLocked && (
                          <Crown className="h-3.5 w-3.5 text-purple-600" data-testid={`locked-icon-${space.id}`} />
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
