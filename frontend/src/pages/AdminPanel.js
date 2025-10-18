import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { 
  Settings, Lock, Eye, EyeOff, DollarSign, Loader2, Plus, Pencil, Trash2, 
  Folder, Grid, CreditCard, ArrowLeft, Users as UsersIcon, Shield 
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('groups'); // groups | spaces | subscriptions
  
  // Data states
  const [spaceGroups, setSpaceGroups] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [groupDialog, setGroupDialog] = useState({ open: false, mode: 'create', data: null });
  const [spaceDialog, setSpaceDialog] = useState({ open: false, mode: 'create', data: null });
  const [tierDialog, setTierDialog] = useState({ open: false, mode: 'create', data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null, name: '' });
  
  // Form states
  const [groupForm, setGroupForm] = useState({ name: '', description: '', icon: '', order: 0 });
  const [spaceForm, setSpaceForm] = useState({
    name: '', description: '', icon: '', space_group_id: '', order: 0,
    visibility: 'public', requires_payment: false, subscription_tier_id: '', auto_join: false,
    space_type: 'post', allow_member_posts: true
  });
  const [tierForm, setTierForm] = useState({
    name: '', description: '', price: 0, currency: 'USD', features: [], is_active: true
  });
  
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSpaceGroups(),
        loadSpaces(),
        loadSubscriptionTiers()
      ]);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSpaceGroups = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/space-groups`, {
        credentials: 'include'
      });
      const data = await response.json();
      setSpaceGroups(data || []);
    } catch (error) {
      console.error('Error loading space groups:', error);
    }
  };

  const loadSpaces = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces`, {
        credentials: 'include'
      });
      const data = await response.json();
      setSpaces(data || []);
    } catch (error) {
      console.error('Error loading spaces:', error);
    }
  };

  const loadSubscriptionTiers = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/subscription-tiers`);
      const data = await response.json();
      setSubscriptionTiers(data || []);
    } catch (error) {
      console.error('Error loading subscription tiers:', error);
    }
  };

  // Space Group handlers
  const handleCreateGroup = () => {
    setGroupForm({ name: '', description: '', icon: '', order: 0 });
    setGroupDialog({ open: true, mode: 'create', data: null });
  };

  const handleEditGroup = (group) => {
    setGroupForm({
      name: group.name,
      description: group.description || '',
      icon: group.icon || '',
      order: group.order || 0
    });
    setGroupDialog({ open: true, mode: 'edit', data: group });
  };

  const handleSaveGroup = async () => {
    setProcessing(true);
    try {
      const url = groupDialog.mode === 'create'
        ? `${process.env.REACT_APP_BACKEND_URL}/api/admin/space-groups`
        : `${process.env.REACT_APP_BACKEND_URL}/api/admin/space-groups/${groupDialog.data.id}`;
      
      const method = groupDialog.mode === 'create' ? 'POST' : 'PUT';
      
      // Clean up form data
      const payload = { ...groupForm };
      
      // Don't send id when creating
      if (groupDialog.mode === 'create') {
        delete payload.id;
      }
      
      // Convert empty strings to null
      if (!payload.description || payload.description === '') {
        payload.description = null;
      }
      if (!payload.icon || payload.icon === '') {
        payload.icon = null;
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save group');
      }

      toast.success(`Space group ${groupDialog.mode === 'create' ? 'created' : 'updated'}!`);
      setGroupDialog({ open: false, mode: 'create', data: null });
      loadSpaceGroups();
    } catch (error) {
      console.error('Group save error:', error);
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Space handlers
  const handleCreateSpace = () => {
    setSpaceForm({
      name: '', description: '', icon: '', space_group_id: 'none', order: 0,
      visibility: 'public', requires_payment: false, subscription_tier_id: 'none', auto_join: false,
      space_type: 'post', allow_member_posts: true
    });
    setSpaceDialog({ open: true, mode: 'create', data: null });
  };

  const handleEditSpace = (space) => {
    setSpaceForm({
      name: space.name,
      description: space.description || '',
      icon: space.icon || '',
      space_group_id: space.space_group_id || 'none',
      order: space.order || 0,
      visibility: space.visibility || 'public',
      requires_payment: space.requires_payment || false,
      subscription_tier_id: space.subscription_tier_id || 'none',
      auto_join: space.auto_join || false,
      space_type: space.space_type || 'post',
      allow_member_posts: space.allow_member_posts !== false
    });
    setSpaceDialog({ open: true, mode: 'edit', data: space });
  };

  const handleSaveSpace = async () => {
    setProcessing(true);
    try {
      const url = spaceDialog.mode === 'create'
        ? `${process.env.REACT_APP_BACKEND_URL}/api/admin/spaces`
        : `${process.env.REACT_APP_BACKEND_URL}/api/admin/spaces/${spaceDialog.data.id}`;
      
      const method = spaceDialog.mode === 'create' ? 'POST' : 'PUT';
      
      // Clean up form data
      const payload = { ...spaceForm };
      
      // Don't send id when creating (let backend generate it)
      if (spaceDialog.mode === 'create') {
        delete payload.id;
      }
      
      // Convert empty strings to null for optional fields
      if (!payload.space_group_id || payload.space_group_id === '' || payload.space_group_id === 'none') {
        payload.space_group_id = null;
      }
      if (!payload.subscription_tier_id || payload.subscription_tier_id === '' || payload.subscription_tier_id === 'none') {
        payload.subscription_tier_id = null;
      }
      if (!payload.description || payload.description === '') {
        payload.description = null;
      }
      if (!payload.icon || payload.icon === '') {
        payload.icon = null;
      }
      
      console.log('Sending payload:', payload);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save space');
      }

      toast.success(`Space ${spaceDialog.mode === 'create' ? 'created' : 'updated'}!`);
      setSpaceDialog({ open: false, mode: 'create', data: null });
      loadSpaces();
    } catch (error) {
      console.error('Space save error:', error);
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Subscription Tier handlers
  const handleCreateTier = () => {
    setTierForm({ name: '', description: '', price: 0, currency: 'USD', features: [], is_active: true });
    setTierDialog({ open: true, mode: 'create', data: null });
  };

  const handleEditTier = (tier) => {
    setTierForm({
      name: tier.name,
      description: tier.description || '',
      price: tier.price || 0,
      currency: tier.currency || 'USD',
      features: tier.features || [],
      is_active: tier.is_active !== false
    });
    setTierDialog({ open: true, mode: 'edit', data: tier });
  };

  const handleSaveTier = async () => {
    setProcessing(true);
    try {
      const url = tierDialog.mode === 'create'
        ? `${process.env.REACT_APP_BACKEND_URL}/api/admin/subscription-tiers`
        : `${process.env.REACT_APP_BACKEND_URL}/api/admin/subscription-tiers/${tierDialog.data.id}`;
      
      const method = tierDialog.mode === 'create' ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(tierForm)
      });

      if (!response.ok) throw new Error('Failed to save tier');

      toast.success(`Subscription tier ${tierDialog.mode === 'create' ? 'created' : 'updated'}!`);
      setTierDialog({ open: false, mode: 'create', data: null });
      loadSubscriptionTiers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    setProcessing(true);
    try {
      const urls = {
        group: `${process.env.REACT_APP_BACKEND_URL}/api/admin/space-groups/${deleteDialog.id}`,
        space: `${process.env.REACT_APP_BACKEND_URL}/api/admin/spaces/${deleteDialog.id}`,
        tier: `${process.env.REACT_APP_BACKEND_URL}/api/admin/subscription-tiers/${deleteDialog.id}`
      };

      const response = await fetch(urls[deleteDialog.type], {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete');
      }

      toast.success('Deleted successfully!');
      setDeleteDialog({ open: false, type: null, id: null, name: '' });
      
      // Reload appropriate data
      if (deleteDialog.type === 'group') loadSpaceGroups();
      else if (deleteDialog.type === 'space') loadSpaces();
      else if (deleteDialog.type === 'tier') loadSubscriptionTiers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getVisibilityBadge = (visibility) => {
    const styles = {
      public: 'bg-green-100 text-green-800',
      private: 'bg-yellow-100 text-yellow-800',
      secret: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[visibility] || styles.public}`}>
        {visibility}
      </span>
    );
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto mb-4" style={{ color: '#8E8E8E' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#011328' }}>Admin Access Required</h2>
          <p style={{ color: '#8E8E8E' }}>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      {/* Header */}
      <div className="bg-white border-b" style={{ borderColor: '#E5E7EB' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#011328' }}>Admin Panel</h1>
                <p className="text-sm" style={{ color: '#8E8E8E' }}>Manage spaces, groups, and subscriptions</p>
              </div>
            </div>
            <Shield className="h-8 w-8" style={{ color: '#0462CB' }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'groups' ? 'default' : 'outline'}
            onClick={() => setActiveTab('groups')}
            className="flex items-center gap-2"
            style={activeTab === 'groups' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          >
            <Folder className="h-4 w-4" />
            Space Groups ({spaceGroups.length})
          </Button>
          <Button
            variant={activeTab === 'spaces' ? 'default' : 'outline'}
            onClick={() => setActiveTab('spaces')}
            className="flex items-center gap-2"
            style={activeTab === 'spaces' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          >
            <Grid className="h-4 w-4" />
            Spaces ({spaces.length})
          </Button>
          <Button
            variant={activeTab === 'subscriptions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('subscriptions')}
            className="flex items-center gap-2"
            style={activeTab === 'subscriptions' ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' } : {}}
          >
            <CreditCard className="h-4 w-4" />
            Subscription Tiers ({subscriptionTiers.length})
          </Button>
        </div>

        {/* Space Groups Tab */}
        {activeTab === 'groups' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#011328' }}>Space Groups</h2>
              <Button
                onClick={handleCreateGroup}
                className="flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}
              >
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            </div>

            <div className="grid gap-4">
              {spaceGroups.map((group) => (
                <div key={group.id} className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{group.icon || '📁'}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold" style={{ color: '#011328' }}>{group.name}</h3>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Position: {group.order}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: '#8E8E8E' }}>{group.description || 'No description'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGroup(group)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog({ open: true, type: 'group', id: group.id, name: group.name })}
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {spaceGroups.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border" style={{ borderColor: '#E5E7EB' }}>
                  <Folder className="h-12 w-12 mx-auto mb-2" style={{ color: '#8E8E8E' }} />
                  <p style={{ color: '#8E8E8E' }}>No space groups yet. Create one to get started!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Spaces Tab */}
        {activeTab === 'spaces' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#011328' }}>Spaces</h2>
              <Button
                onClick={handleCreateSpace}
                className="flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}
              >
                <Plus className="h-4 w-4" />
                Create Space
              </Button>
            </div>

            {/* Standalone Spaces (No Group) */}
            {spaces.filter(s => !s.space_group_id).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2" style={{ color: '#6B7280' }}>
                  Standalone Spaces
                </h3>
                <div className="grid gap-3">
                  {spaces.filter(s => !s.space_group_id).sort((a, b) => a.order - b.order).map((space) => {
                    const tier = subscriptionTiers.find(t => t.id === space.subscription_tier_id);
                    
                    return (
                      <div key={space.id} className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="text-2xl">{space.icon || '💬'}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold" style={{ color: '#011328' }}>{space.name}</h3>
                                {getVisibilityBadge(space.visibility)}
                                {space.auto_join && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Auto-Join
                                  </span>
                                )}
                                {space.requires_payment && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    <DollarSign className="h-3 w-3 inline" /> Paid
                                  </span>
                                )}
                              </div>
                              <p className="text-sm" style={{ color: '#8E8E8E' }}>{space.description || 'No description'}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: '#8E8E8E' }}>
                                <span>Order: {space.order}</span>
                                <span>Members: {space.member_count || 0}</span>
                                {space.requires_payment && tier && (
                                  <span>Tier: {tier.name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSpace(space)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteDialog({ open: true, type: 'space', id: space.id, name: space.name })}
                              style={{ color: '#EF4444' }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grouped Spaces */}
            {spaceGroups.sort((a, b) => a.order - b.order).map((group) => {
              const groupSpaces = spaces.filter(s => s.space_group_id === group.id).sort((a, b) => a.order - b.order);
              if (groupSpaces.length === 0) return null;

              return (
                <div key={group.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{group.icon || '📁'}</span>
                    <h3 className="text-sm font-semibold" style={{ color: '#011328' }}>
                      {group.name}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100" style={{ color: '#6B7280' }}>
                      {groupSpaces.length} {groupSpaces.length === 1 ? 'space' : 'spaces'}
                    </span>
                  </div>
                  <div className="grid gap-3 pl-8">
                    {groupSpaces.map((space) => {
                      const tier = subscriptionTiers.find(t => t.id === space.subscription_tier_id);
                      
                      return (
                        <div key={space.id} className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="text-2xl">{space.icon || '💬'}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold" style={{ color: '#011328' }}>{space.name}</h3>
                                  {getVisibilityBadge(space.visibility)}
                                  {space.auto_join && (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      Auto-Join
                                    </span>
                                  )}
                                  {space.requires_payment && (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      <DollarSign className="h-3 w-3 inline" /> Paid
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm" style={{ color: '#8E8E8E' }}>{space.description || 'No description'}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: '#8E8E8E' }}>
                                  <span>Order: {space.order}</span>
                                  <span>Members: {space.member_count || 0}</span>
                                  {space.requires_payment && tier && (
                                    <span>Tier: {tier.name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSpace(space)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteDialog({ open: true, type: 'space', id: space.id, name: space.name })}
                                style={{ color: '#EF4444' }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {spaces.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border" style={{ borderColor: '#E5E7EB' }}>
                <Grid className="h-12 w-12 mx-auto mb-2" style={{ color: '#8E8E8E' }} />
                <p style={{ color: '#8E8E8E' }}>No spaces yet. Create one to get started!</p>
              </div>
            )}
          </div>
        )}

        {/* Subscription Tiers Tab */}
        {activeTab === 'subscriptions' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#011328' }}>Subscription Tiers</h2>
              <Button
                onClick={handleCreateTier}
                className="flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}
              >
                <Plus className="h-4 w-4" />
                Create Tier
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {subscriptionTiers.map((tier) => (
                <div key={tier.id} className="bg-white rounded-lg p-6 border hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#011328' }}>{tier.name}</h3>
                      <p className="text-2xl font-bold" style={{ color: '#0462CB' }}>
                        ${tier.price}
                        <span className="text-sm font-normal" style={{ color: '#8E8E8E' }}>/{tier.currency}/mo</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTier(tier)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog({ open: true, type: 'tier', id: tier.id, name: tier.name })}
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm mb-3" style={{ color: '#8E8E8E' }}>{tier.description || 'No description'}</p>
                  {tier.features && tier.features.length > 0 && (
                    <ul className="space-y-1">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="text-sm flex items-center gap-2" style={{ color: '#3B3B3B' }}>
                          <span className="text-green-500">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: '#E5E7EB' }}>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tier.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
              {subscriptionTiers.length === 0 && (
                <div className="col-span-2 text-center py-12 bg-white rounded-lg border" style={{ borderColor: '#E5E7EB' }}>
                  <CreditCard className="h-12 w-12 mx-auto mb-2" style={{ color: '#8E8E8E' }} />
                  <p style={{ color: '#8E8E8E' }}>No subscription tiers yet. Create one to get started!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Space Group Dialog */}
      <Dialog open={groupDialog.open} onOpenChange={(open) => setGroupDialog({ ...groupDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{groupDialog.mode === 'create' ? 'Create' : 'Edit'} Space Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g., Learning Spaces"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Brief description"
                rows={3}
              />
            </div>
            <div>
              <Label>Icon (emoji)</Label>
              <Input
                value={groupForm.icon}
                onChange={(e) => setGroupForm({ ...groupForm, icon: e.target.value })}
                placeholder="📚"
              />
            </div>
            <div>
              <Label>Order</Label>
              <Input
                type="number"
                value={groupForm.order}
                onChange={(e) => setGroupForm({ ...groupForm, order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog({ open: false, mode: 'create', data: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} disabled={!groupForm.name || processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Space Dialog */}
      <Dialog open={spaceDialog.open} onOpenChange={(open) => setSpaceDialog({ ...spaceDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{spaceDialog.mode === 'create' ? 'Create' : 'Edit'} Space</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={spaceForm.name}
                  onChange={(e) => setSpaceForm({ ...spaceForm, name: e.target.value })}
                  placeholder="e.g., Introduction"
                />
              </div>
              <div>
                <Label>Icon (emoji)</Label>
                <Input
                  value={spaceForm.icon}
                  onChange={(e) => setSpaceForm({ ...spaceForm, icon: e.target.value })}
                  placeholder="👋"
                />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={spaceForm.description}
                onChange={(e) => setSpaceForm({ ...spaceForm, description: e.target.value })}
                placeholder="Brief description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Space Group (Optional)</Label>
                <Select value={spaceForm.space_group_id} onValueChange={(value) => setSpaceForm({ ...spaceForm, space_group_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Standalone space" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standalone (No Group)</SelectItem>
                    {spaceGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.icon} {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Order</Label>
                <Input
                  type="number"
                  value={spaceForm.order}
                  onChange={(e) => setSpaceForm({ ...spaceForm, order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label>Visibility</Label>
              <Select value={spaceForm.visibility} onValueChange={(value) => setSpaceForm({ ...spaceForm, visibility: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Visible to all</SelectItem>
                  <SelectItem value="private">Private - Must join to see</SelectItem>
                  <SelectItem value="secret">Secret - Invite only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_join"
                checked={spaceForm.auto_join}
                onChange={(e) => setSpaceForm({ ...spaceForm, auto_join: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="auto_join" className="cursor-pointer">Auto-join users when they register</Label>
            </div>

            <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
              <h4 className="font-semibold mb-3" style={{ color: '#011328' }}>Space Type & Behavior</h4>
              
              <div className="mb-4">
                <Label>Space Type</Label>
                <Select value={spaceForm.space_type} onValueChange={(value) => setSpaceForm({ ...spaceForm, space_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">📝 Post - Social media style feed</SelectItem>
                    <SelectItem value="qa">❓ Q&A - Question & Answer format</SelectItem>
                    <SelectItem value="announcement">📢 Announcement - Admin updates only</SelectItem>
                    <SelectItem value="resource">📚 Resource - Shared resources/links</SelectItem>
                    <SelectItem value="event">📅 Event - Event listings</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                  {spaceForm.space_type === 'post' && 'Standard social media feed with posts, likes, and comments'}
                  {spaceForm.space_type === 'qa' && 'Question-based format with answers and voting'}
                  {spaceForm.space_type === 'announcement' && 'One-way communication for important updates'}
                  {spaceForm.space_type === 'resource' && 'Curated collection of resources and links'}
                  {spaceForm.space_type === 'event' && 'Event calendar and RSVP management'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allow_member_posts"
                  checked={spaceForm.allow_member_posts}
                  onChange={(e) => setSpaceForm({ ...spaceForm, allow_member_posts: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="allow_member_posts" className="cursor-pointer">Allow members to create posts</Label>
              </div>
              <p className="text-xs mt-1 ml-6" style={{ color: '#8E8E8E' }}>
                {spaceForm.allow_member_posts 
                  ? 'All members can create posts in this space' 
                  : 'Only admins can create posts. Members can comment and react'}
              </p>
            </div>

            <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="requires_payment"
                  checked={spaceForm.requires_payment}
                  onChange={(e) => setSpaceForm({ ...spaceForm, requires_payment: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="requires_payment" className="cursor-pointer">Require payment/subscription</Label>
              </div>

              {spaceForm.requires_payment && (
                <div>
                  <Label>Subscription Tier *</Label>
                  <Select 
                    value={spaceForm.subscription_tier_id} 
                    onValueChange={(value) => setSpaceForm({ ...spaceForm, subscription_tier_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No tier selected</SelectItem>
                      {subscriptionTiers.filter(t => t.is_active).map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name} - ${tier.price}/{tier.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subscriptionTiers.filter(t => t.is_active).length === 0 && (
                    <p className="text-xs mt-1 text-orange-600">No active subscription tiers. Create one first.</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpaceDialog({ open: false, mode: 'create', data: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveSpace} disabled={!spaceForm.name || processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Tier Dialog */}
      <Dialog open={tierDialog.open} onOpenChange={(open) => setTierDialog({ ...tierDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tierDialog.mode === 'create' ? 'Create' : 'Edit'} Subscription Tier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={tierForm.name}
                onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                placeholder="e.g., Pro"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={tierForm.description}
                onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                placeholder="Brief description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={tierForm.price}
                  onChange={(e) => setTierForm({ ...tierForm, price: parseFloat(e.target.value) || 0 })}
                  placeholder="9.99"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={tierForm.currency}
                  onChange={(e) => setTierForm({ ...tierForm, currency: e.target.value })}
                  placeholder="USD"
                />
              </div>
            </div>
            <div>
              <Label>Features (comma-separated)</Label>
              <Textarea
                value={tierForm.features.join(', ')}
                onChange={(e) => setTierForm({ ...tierForm, features: e.target.value.split(',').map(f => f.trim()).filter(Boolean) })}
                placeholder="Access to premium spaces, Priority support"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={tierForm.is_active}
                onChange={(e) => setTierForm({ ...tierForm, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierDialog({ open: false, mode: 'create', data: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveTier} disabled={!tierForm.name || processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p style={{ color: '#3B3B3B' }}>
              Are you sure you want to delete <strong>{deleteDialog.name}</strong>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, type: null, id: null, name: '' })}>
              Cancel
            </Button>
            <Button 
              onClick={handleDelete} 
              disabled={processing}
              style={{ backgroundColor: '#EF4444' }}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
