import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { membersAPI, authAPI, invitesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import Header from '../components/Header';
import { Search, Grid, List, Loader2, UserPlus, Link2, Copy, Check } from 'lucide-react';
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
  const [inviteMethod, setInviteMethod] = useState('email'); // 'email' or 'link'
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Bulk selection states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data } = await membersAPI.getMembers();
      // Sort members alphabetically by name
      const sortedMembers = data.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(sortedMembers);
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
      // Use admin endpoint to create user without logging in as them
      const { data } = await invitesAPI.createUserDirectly(inviteFormData);
      toast.success(`${inviteFormData.name} has been invited successfully!`);
      setInviteDialogOpen(false);
      setInviteFormData({ name: '', email: '', role: 'learner' });
      loadMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to invite member');
    }
  };

  const handleGenerateInviteLink = async () => {
    try {
      const { data } = await invitesAPI.generateInvite(inviteFormData.role);
      const inviteLink = `${window.location.origin}/register?invite=${data.token}`;
      setGeneratedInviteLink(inviteLink);
      toast.success('Invite link generated!');
    } catch (error) {
      toast.error('Failed to generate invite link');
    }
  };

  const handleCopyInviteLink = () => {
    if (!generatedInviteLink) {
      toast.error('Please generate a link first');
      return;
    }
    
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(generatedInviteLink)
        .then(() => {
          setLinkCopied(true);
          toast.success('Link copied to clipboard!');
          setTimeout(() => setLinkCopied(false), 2000);
        })
        .catch(() => {
          // Fallback to legacy method
          fallbackCopyInviteLink();
        });
    } else {
      // Use fallback method directly
      fallbackCopyInviteLink();
    }
  };

  const fallbackCopyInviteLink = () => {
    try {
      // Create temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = generatedInviteLink;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      // Execute copy command
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        setLinkCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setLinkCopied(false), 2000);
      } else {
        toast.error('Failed to copy. Please copy manually.');
      }
    } catch (error) {
      console.error('Fallback copy failed:', error);
      toast.error('Failed to copy. Please copy manually.');
    }
  };

  const handleInviteMethodChange = (method) => {
    setInviteMethod(method);
    setGeneratedInviteLink('');
    setLinkCopied(false);
  };


  // Bulk selection handlers
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedMembers(new Set());
  };

  const toggleMemberSelection = (memberId) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const selectAllMembers = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedMembers.size === 0) {
      toast.error('No members selected');
      return;
    }

    if (!window.confirm(`Archive ${selectedMembers.size} member(s)?`)) {
      return;
    }

    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const memberId of selectedMembers) {
      try {
        await membersAPI.archiveMember(memberId);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to archive member ${memberId}:`, error);
      }
    }

    setBulkActionLoading(false);
    
    if (successCount > 0) {
      toast.success(`Archived ${successCount} member(s)`);
      loadMembers();
    }
    if (failCount > 0) {
      toast.error(`Failed to archive ${failCount} member(s)`);
    }

    setSelectedMembers(new Set());
    setSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    if (selectedMembers.size === 0) {
      toast.error('No members selected');
      return;
    }

    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${selectedMembers.size} member(s)? This cannot be undone!`)) {
      return;
    }

    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const memberId of selectedMembers) {
      try {
        await membersAPI.deleteMember(memberId);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to delete member ${memberId}:`, error);
      }
    }

    setBulkActionLoading(false);
    
    if (successCount > 0) {
      toast.success(`Deleted ${successCount} member(s)`);
      loadMembers();
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} member(s)`);
    }

    setSelectedMembers(new Set());
    setSelectionMode(false);
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
      <Header />

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
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Invite New Member</DialogTitle>
                    </DialogHeader>
                    
                    {/* Invite Method Selector */}
                    <div className="flex gap-2 mb-4">
                      <Button
                        type="button"
                        variant={inviteMethod === 'email' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleInviteMethodChange('email')}
                        className="flex-1"
                        style={inviteMethod === 'email' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' } : {}}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Direct Invite
                      </Button>
                      <Button
                        type="button"
                        variant={inviteMethod === 'link' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleInviteMethodChange('link')}
                        className="flex-1"
                        style={inviteMethod === 'link' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' } : {}}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Invite Link
                      </Button>
                    </div>

                    {inviteMethod === 'email' ? (
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
                            <SelectTrigger id="role">
                              <SelectValue placeholder="Select access level" />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={5} className="z-[100]">
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
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="link-role">Access Level</Label>
                          <Select value={inviteFormData.role} onValueChange={(value) => setInviteFormData({ ...inviteFormData, role: value })}>
                            <SelectTrigger id="link-role">
                              <SelectValue placeholder="Select access level" />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={5} className="z-[100]">
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="mentor">Team Member</SelectItem>
                              <SelectItem value="business_owner">Community Manager</SelectItem>
                              <SelectItem value="learner">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {!generatedInviteLink ? (
                          <Button 
                            type="button" 
                            onClick={handleGenerateInviteLink} 
                            className="w-full"
                            style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
                          >
                            <Link2 className="h-4 w-4 mr-2" />
                            Generate Invite Link
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-3 rounded-lg" style={{ backgroundColor: '#E6EFFA' }}>
                              <Label className="text-xs mb-1" style={{ color: '#011328' }}>Invite Link (expires in 7 days)</Label>
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  value={generatedInviteLink}
                                  readOnly
                                  className="text-sm"
                                  style={{ backgroundColor: 'white' }}
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  onClick={handleCopyInviteLink}
                                  disabled={!generatedInviteLink}
                                  style={{ background: linkCopied ? '#10B981' : 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
                                >
                                  {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            <Button 
                              type="button" 
                              onClick={handleGenerateInviteLink} 
                              variant="outline"
                              className="w-full"
                            >
                              Generate New Link
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
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
                      {/* Avatar with Team Badge */}
                      <div className="relative mb-4">
                        <Avatar className="h-24 w-24">
                          {member.picture ? (
                            <AvatarImage src={member.picture} />
                          ) : (
                            <AvatarFallback style={{ backgroundColor: avatarColor, color: 'white', fontSize: '2rem' }}>
                              {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        {/* Team Badge */}
                        {member.is_team_member && (
                          <img 
                            src="/team-badge.png" 
                            alt="Team Badge"
                            className="absolute"
                            style={{
                              bottom: '-4px',
                              left: '-4px',
                              width: '100px',
                              height: '100px',
                              objectFit: 'contain'
                            }}
                          />
                        )}
                      </div>
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
                      {/* Avatar with Team Badge */}
                      <div className="relative">
                        <Avatar className="h-16 w-16">
                          {member.picture ? (
                            <AvatarImage src={member.picture} />
                          ) : (
                            <AvatarFallback style={{ backgroundColor: avatarColor, color: 'white', fontSize: '1.5rem' }}>
                              {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        {/* Team Badge */}
                        {member.is_team_member && (
                          <img 
                            src="/team-badge.png" 
                            alt="Team Badge"
                            className="absolute"
                            style={{
                              bottom: '-3px',
                              left: '-3px',
                              width: '70px',
                              height: '70px',
                              objectFit: 'contain'
                            }}
                          />
                        )}
                      </div>
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
