import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { platformSettingsAPI } from '../lib/api';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import NotificationBell from './NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Home, Users, MessageCircle, Settings, LogOut, Crown, Trophy } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="border-b sticky top-0 z-50" style={{ backgroundColor: '#011328', borderColor: '#022955' }}>
      <div className="px-6 py-3 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center">
          <Link to="/dashboard">
            <img 
              src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/2ftx37lf_white-blackbackground.png" 
              alt="ABCD" 
              className="h-10 w-10"
            />
          </Link>
        </div>

        {/* Navigation */}
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

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Leaderboard Icon */}
          <Link to="/leaderboard">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-yellow-400 hover:text-yellow-300" 
              style={{ backgroundColor: 'transparent' }}
              title="Leaderboard"
            >
              <Trophy className="h-5 w-5" />
            </Button>
          </Link>

          {/* Notifications */}
          <NotificationBell />

          {/* User Dropdown */}
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
                  Admin Settings
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
  );
}
