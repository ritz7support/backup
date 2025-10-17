import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { membersAPI, authAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Search, Grid, List, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Bell, MessageCircle, Settings, LogOut, Crown, Home, Calendar, Users } from 'lucide-react';

export default function MembersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({
    name: '',
    email: '',
    role: 'learner'
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data } = await membersAPI.getMembers();
      setMembers(data);
    } catch (error) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    try {
      // For now, we'll just create the user directly
      // In production, this would send an invitation email
      const { data } = await authAPI.register({
        ...inviteFormData,
        password: Math.random().toString(36).slice(-8) // Generate random password
      });
      toast.success(`Invitation sent to ${inviteFormData.email}`);
      setInviteDialogOpen(false);
      setInviteFormData({ name: '', email: '', role: 'learner' });
      loadMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to invite member');
    }
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.skills && member.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
  const getColorForMember = (memberId) => {
    const hash = memberId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F3F4F6' }} data-testid="members-page">
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
            <Link to="/dashboard" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors" data-testid="nav-home">
              <Home className="h-5 w-5" />
              Home
            </Link>
            <Link 
              to="/members" 
              className="font-medium flex items-center gap-2 px-4 py-2 rounded-lg transition-colors" 
              style={{ backgroundColor: '#0462CB', color: 'white' }}
              data-testid="nav-members"
            >
              <Users className="h-5 w-5" />
              Members
            </Link>
            <Link to="/dms" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors" data-testid="nav-dms">
              <MessageCircle className="h-5 w-5" />
              Messages
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white" style={{ backgroundColor: 'transparent' }} data-testid="notifications-btn">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-gray-300 hover:text-white" style={{ backgroundColor: 'transparent' }} data-testid="user-menu-trigger">
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
                    <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#0462CB' }}>
                      <Crown className="h-3 w-3" />
                      Founding Member
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/profile/${user?.id}`)}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pricing')}>Upgrade Plan</DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
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

      {/* Main Content - No Sidebar */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#011328' }}>
                Members ({members.length})
              </h1>
              <p style={{ color: '#3B3B3B' }}>Connect with community members</p>
            </div>
            <div className="flex gap-3">
              {user?.role === 'admin' && (
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }} data-testid="invite-member-btn">
                      <UserPlus className="h-5 w-5 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite New Member</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleInviteMember} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={inviteFormData.name}
                          onChange={(e) => setInviteFormData({ ...inviteFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={inviteFormData.email}
                          onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Access Level</Label>
                        <Select value={inviteFormData.role} onValueChange={(value) => setInviteFormData({ ...inviteFormData, role: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="mentor">Team Member</SelectItem>
                            <SelectItem value="business_owner">Community Manager</SelectItem>
                            <SelectItem value="learner">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}>
                        Send Invitation
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  style={viewMode === 'grid' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' } : {}}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  style={viewMode === 'list' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' } : {}}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#8E8E8E' }} />
              <Input
                type="text"
                placeholder="Search members by name, email, or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6' : 'space-y-4'}>
              {filteredMembers.map((member) => {
                const avatarColor = getColorForMember(member.id);
                
                return viewMode === 'grid' ? (
                  <div
                    key={member.id}
                    className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                    style={{ borderColor: '#D1D5DB' }}
                    onClick={() => navigate(`/profile/${member.id}`)}
                    data-testid={`member-card-${member.id}`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="h-24 w-24 mb-4">
                        {member.picture ? (
                          <AvatarImage src={member.picture} />
                        ) : (
                          <AvatarFallback style={{ backgroundColor: avatarColor, color: 'white', fontSize: '2rem' }}>
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <h3 className="font-semibold text-lg mb-1" style={{ color: '#011328' }}>{member.name}</h3>
                      {member.role && (
                        <p className="text-sm mb-2 capitalize" style={{ color: '#8E8E8E' }}>
                          {member.role.replace('_', ' ')}
                        </p>
                      )}
                      {member.is_founding_member && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs mb-2" style={{ backgroundColor: '#E6EFFA', color: '#0462CB' }}>
                          <Crown className="h-3 w-3" />
                          Founding Member
                        </div>
                      )}
                      {member.skills && member.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-2">
                          {member.skills.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded text-xs"
                              style={{ backgroundColor: '#E6EFFA', color: '#011328' }}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    key={member.id}
                    className="bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                    style={{ borderColor: '#D1D5DB' }}
                    onClick={() => navigate(`/profile/${member.id}`)}
                    data-testid={`member-card-${member.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        {member.picture ? (
                          <AvatarImage src={member.picture} />
                        ) : (
                          <AvatarFallback style={{ backgroundColor: avatarColor, color: 'white', fontSize: '1.5rem' }}>
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg" style={{ color: '#011328' }}>{member.name}</h3>
                          {member.is_founding_member && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ backgroundColor: '#E6EFFA', color: '#0462CB' }}>
                              <Crown className="h-3 w-3" />
                              Founding
                            </div>
                          )}
                        </div>
                        <p className="text-sm mb-2" style={{ color: '#8E8E8E' }}>{member.email}</p>
                        {member.skills && member.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {member.skills.slice(0, 5).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 rounded text-xs"
                                style={{ backgroundColor: '#E6EFFA', color: '#011328' }}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filteredMembers.length === 0 && (
            <div className="text-center py-20">
              <p className="text-lg" style={{ color: '#8E8E8E' }}>No members found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
