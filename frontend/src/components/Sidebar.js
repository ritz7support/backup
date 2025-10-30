import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Crown, Lightbulb, Lock, LockOpen, Key, UserPlus, CheckCircle } from 'lucide-react';
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

  // Get spaces by group
  const getSpacesByGroup = (groupId) => {
    return spaces.filter(s => s.space_group_id === groupId).sort((a, b) => a.order - b.order);
  };

  // Get standalone spaces (no group)
  const standaloneSpaces = spaces.filter(s => !s.space_group_id).sort((a, b) => a.order - b.order);

  // Create unified list of items (groups and standalone spaces) sorted by order
  const getSidebarItems = () => {
    const items = [];
    
    // Add all space groups
    spaceGroups.forEach(group => {
      items.push({ type: 'group', data: group, order: group.order || 0 });
    });
    
    // Add all standalone spaces
    standaloneSpaces.forEach(space => {
      items.push({ type: 'space', data: space, order: space.order || 0 });
    });
    
    // Sort by order
    return items.sort((a, b) => a.order - b.order);
  };

  const renderSpaceItem = (space) => {
    const isActive = isSpaceActive(space.id);
    const isLocked = space.requires_payment && user?.membership_tier === 'free';
    const isPrivateNotMember = space.visibility === 'private' && !space.is_member;
    const isPrivateMember = space.visibility === 'private' && space.is_member;
    const isSecretMember = space.visibility === 'secret' && space.is_member;
    const isPublicNotMember = space.visibility === 'public' && !space.is_member;
    const isPublicMember = space.visibility === 'public' && space.is_member;
    
    // Determine the correct route based on space type
    const spaceRoute = space.space_type === 'learning' ? `/learning/${space.id}` : `/space/${space.id}`;

    return (
      <Link
        key={space.id}
        to={isLocked ? '/pricing' : spaceRoute}
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
        {isPrivateNotMember && (
          <Lock className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} data-testid={`private-locked-icon-${space.id}`} />
        )}
        {isPrivateMember && (
          <LockOpen className="h-3.5 w-3.5" style={{ color: '#10B981' }} data-testid={`private-unlocked-icon-${space.id}`} />
        )}
        {isSecretMember && (
          <Key className="h-3.5 w-3.5" style={{ color: '#8B5CF6' }} data-testid={`secret-key-icon-${space.id}`} />
        )}
        {isPublicNotMember && (
          <UserPlus className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} data-testid={`public-join-icon-${space.id}`} />
        )}
        {isPublicMember && (
          <CheckCircle className="h-3.5 w-3.5" style={{ color: '#10B981' }} data-testid={`public-joined-icon-${space.id}`} />
        )}
      </Link>
    );
  };

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

        {/* Mixed Groups and Spaces in Order */}
        {getSidebarItems().map((item, index) => {
          if (item.type === 'space') {
            // Render standalone space
            return renderSpaceItem(item.data);
          } else if (item.type === 'group') {
            // Render group with its spaces
            const group = item.data;
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
                    {group.icon && <span className="text-lg">{group.icon}</span>}
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
                      const isPrivateNotMember = space.visibility === 'private' && !space.is_member;
                      const isPrivateMember = space.visibility === 'private' && space.is_member;
                      const isSecretMember = space.visibility === 'secret' && space.is_member;
                      const isPublicNotMember = space.visibility === 'public' && !space.is_member;
                      const isPublicMember = space.visibility === 'public' && space.is_member;
                      
                      // Determine the correct route based on space type
                      const spaceRoute = space.space_type === 'learning' ? `/learning/${space.id}` : `/space/${space.id}`;

                      return (
                        <Link
                          key={space.id}
                          to={isLocked ? '/pricing' : spaceRoute}
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
                          {isPrivateNotMember && (
                            <Lock className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} data-testid={`private-locked-icon-${space.id}`} />
                          )}
                          {isPrivateMember && (
                            <LockOpen className="h-3.5 w-3.5" style={{ color: '#10B981' }} data-testid={`private-unlocked-icon-${space.id}`} />
                          )}
                          {isSecretMember && (
                            <Key className="h-3.5 w-3.5" style={{ color: '#8B5CF6' }} data-testid={`secret-key-icon-${space.id}`} />
                          )}
                          {isPublicNotMember && (
                            <UserPlus className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} data-testid={`public-join-icon-${space.id}`} />
                          )}
                          {isPublicMember && (
                            <CheckCircle className="h-3.5 w-3.5" style={{ color: '#10B981' }} data-testid={`public-joined-icon-${space.id}`} />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
