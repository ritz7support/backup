import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { spacesAPI, usersAPI, leaderboardAPI, platformSettingsAPI, messagingAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { 
  Settings, Lock, Eye, EyeOff, DollarSign, Loader2, Plus, Pencil, Trash2, 
  Folder, Grid, CreditCard, ArrowLeft, Users as UsersIcon, Shield, Sparkles,
  LayoutDashboard, MessageSquare, Award
} from 'lucide-react';
import { toast } from 'sonner';
import Header from '../components/Header';

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // Changed to sidebar navigation
  
  // Data states
  const [spaceGroups, setSpaceGroups] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState({ 
    requires_payment_to_join: false, 
    allowed_tier_ids: [],
    community_name: 'Community',
    primary_color: '#0462CB',
    logo: null
  });
  const [messagingSettings, setMessagingSettings] = useState({
    who_can_initiate: 'all'
  });
  const [brandingSettings, setBrandingSettings] = useState({ logo: '', favicon: '', primary_color: '#0462CB', community_name: 'Community' });
  const [onboardingSteps, setOnboardingSteps] = useState([]);
  const [onboardingSettings, setOnboardingSettings] = useState({ completion_points: 5, enabled: true });

  
  // Dialog states
  const [groupDialog, setGroupDialog] = useState({ open: false, mode: 'create', data: null });
  const [spaceDialog, setSpaceDialog] = useState({ open: false, mode: 'create', data: null });
  const [tierDialog, setTierDialog] = useState({ open: false, mode: 'create', data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null, name: '' });
  const [membersDialog, setMembersDialog] = useState({ open: false, spaceId: null, spaceName: '', members: [] });
  const [invitesDialog, setInvitesDialog] = useState({ open: false, spaceId: null, spaceName: '', invites: [] });
  const [managersDialog, setManagersDialog] = useState({ open: false, spaceId: null, spaceName: '', managers: [], allMembers: [] });
  const [spaceSelectDialog, setSpaceSelectDialog] = useState({ open: false, userId: null, userName: '', selectedSpaces: [] });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'default' });
  const [softBlockDialog, setSoftBlockDialog] = useState({ open: false, spaceId: null, spaceName: '', userId: null, userName: '' });
  const [levelDialog, setLevelDialog] = useState({ open: false, mode: 'create', data: null });
  
  
  // Form states
  const [groupForm, setGroupForm] = useState({ name: '', description: '', icon: '', order: 0 });
  const [levelForm, setLevelForm] = useState({ level_number: '', level_name: '', points_required: '' });
  const [spaceForm, setSpaceForm] = useState({
    name: '', description: '', icon: '', space_group_id: '', order: 0,
    visibility: 'public', requires_payment: false, subscription_tier_id: '', auto_join: false,
    space_type: 'post', allow_member_posts: true, welcome_title: '', welcome_message: ''
  });
  const [tierForm, setTierForm] = useState({
    name: '', 
    description: '', 
    payment_type: 'recurring',
    price_inr: null, 
    price_usd: null,
    razorpay_plan_id: '',
    stripe_price_id: '',
    duration_days: 30,
    features: [], 
    is_active: true
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
        loadSubscriptionTiers(),
        loadAllUsers(),
        loadLevels(),
        loadPlatformSettings(),
        loadMessagingSettings()
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


  const loadAllUsers = async () => {
    try {
      const { data } = await usersAPI.getAllUsersWithMemberships();
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };


  const loadLevels = async () => {
    try {
      const { data } = await leaderboardAPI.getLevels();
      setLevels(data || []);
    } catch (error) {
      console.error('Error loading levels:', error);
    }
  };


  const loadPlatformSettings = async () => {
    try {
      const { data } = await platformSettingsAPI.getSettings();
      setPlatformSettings(data || { requires_payment_to_join: false, allowed_tier_ids: [] });
    } catch (error) {
      console.error('Error loading platform settings:', error);
    }
  };

  const loadMessagingSettings = async () => {
    try {
      const { data } = await messagingAPI.getMessagingSettings();
      setMessagingSettings(data || { who_can_initiate: 'all' });
    } catch (error) {
      console.error('Error loading messaging settings:', error);
    }
  };

  // Platform settings handler
  const handleUpdatePlatformSettings = async (newSettings) => {
    setProcessing(true);
    try {
      await platformSettingsAPI.updateSettings(newSettings);
      setPlatformSettings(newSettings);
      toast.success('Platform settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update platform settings');
      console.error('Error updating platform settings:', error);
    } finally {
      setProcessing(false);
    }
  };


  // Logo upload handler
  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    // Convert to Base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      const newSettings = {
        ...platformSettings,
        logo: base64
      };
      await handleUpdatePlatformSettings(newSettings);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    const newSettings = {
      ...platformSettings,
      logo: null
    };
    await handleUpdatePlatformSettings(newSettings);
  };




  // User role management
  const handlePromoteToAdmin = async (userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Promote to Global Admin',
      message: `Promote ${userName} to Admin? They will have full access to all admin features.`,
      variant: 'success',
      onConfirm: async () => {
        try {
          await usersAPI.promoteToAdmin(userId);
          toast.success(`${userName} promoted to Admin!`);
          loadAllUsers();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to promote user');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const handleDemoteFromAdmin = async (userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Demote from Admin',
      message: `Demote ${userName} from Admin to Learner? They will lose admin access.`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          await usersAPI.demoteFromAdmin(userId);
          toast.success(`${userName} demoted to Learner`);
          loadAllUsers();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to demote user');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  // Team Member Badge Management
  const handleSetTeamMember = async (userId, userName, currentStatus) => {
    const action = currentStatus ? 'remove' : 'grant';
    setConfirmDialog({
      open: true,
      title: currentStatus ? 'Remove Team Member Badge' : 'Grant Team Member Badge',
      message: `${action === 'grant' ? 'Grant' : 'Remove'} Team Member badge ${action === 'grant' ? 'to' : 'from'} ${userName}?`,
      variant: currentStatus ? 'warning' : 'success',
      onConfirm: async () => {
        try {
          await usersAPI.setTeamMember(userId, !currentStatus);
          toast.success(`Team Member badge ${action === 'grant' ? 'granted to' : 'removed from'} ${userName}`);
          loadAllUsers();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to update team member status');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };




  // Members management
  const handleViewMembers = async (spaceId, spaceName) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members-detailed`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembersDialog({ open: true, spaceId, spaceName, members: data.members || [] });
    } catch (error) {
      toast.error('Failed to load members');
    }
  };

  const handleRemoveMember = async (spaceId, userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Member',
      message: `Remove ${userName} from this space?`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to remove member');
          toast.success('Member removed');
          handleViewMembers(spaceId, membersDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.message);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const handleBlockMember = async (spaceId, userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Block Member',
      message: `Block ${userName}? They won't be able to post or comment.`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members/${userId}/block`, {
            method: 'PUT',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to block member');
          toast.success('Member blocked');
          handleViewMembers(spaceId, membersDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.message);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const handleSoftBlockMember = async (spaceId, userId, userName, spaceName) => {
    setSoftBlockDialog({ open: true, spaceId, userId, userName, spaceName });
  };

  const handleConfirmSoftBlock = async (blockType, expiresAt) => {
    const { spaceId, userId, userName, spaceName } = softBlockDialog;
    try {
      await spacesAPI.blockMember(spaceId, userId, blockType, expiresAt);
      toast.success(`${userName} ${blockType}-blocked ${expiresAt ? `until ${new Date(expiresAt).toLocaleString()}` : 'permanently'}`);
      if (membersDialog.open) {
        handleViewMembers(spaceId, spaceName); // Reload if in members dialog
      }
      setSoftBlockDialog({ open: false, spaceId: null, userId: null, userName: '', spaceName: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to block member');
    }
  };


  const handleUnblockMember = async (spaceId, userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Unblock Member',
      message: `Unblock ${userName}?`,
      variant: 'success',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members/${userId}/unblock`, {
            method: 'PUT',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to unblock member');
          toast.success('Member unblocked');
          handleViewMembers(spaceId, membersDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.message);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const handlePromoteToManager = async (spaceId, userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Promote to Space Manager',
      message: `Promote ${userName} to manager? They can moderate content and manage members.`,
      variant: 'success',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members/${userId}/promote`, {
            method: 'PUT',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to promote member');
          toast.success(`${userName} promoted to manager`);
          handleViewMembers(spaceId, membersDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.message);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const handleDemoteFromManager = async (spaceId, userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Manager Role',
      message: `Demote ${userName} from manager to regular member?`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members/${userId}/demote`, {
            method: 'PUT',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to demote manager');
          toast.success('Manager demoted to member');
          handleViewMembers(spaceId, membersDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.message);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  // Space invites management (for secret spaces)
  const handleViewInvites = async (spaceId, spaceName) => {
    try {
      const { data } = await spacesAPI.getSpaceInvites(spaceId);
      setInvitesDialog({ open: true, spaceId, spaceName, invites: data || [] });
    } catch (error) {
      toast.error('Failed to load invites');
    }
  };

  const handleCreateInvite = async (spaceId, maxUses, expiresAt) => {
    try {
      const { data } = await spacesAPI.createSpaceInvite(spaceId, maxUses, expiresAt);
      toast.success('Invite created!');
      const inviteLink = `${window.location.origin}/join/${data.invite_code}`;
      navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied to clipboard!');
      handleViewInvites(spaceId, invitesDialog.spaceName); // Reload
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create invite');
    }
  };

  const handleDeactivateInvite = async (inviteCode) => {
    setConfirmDialog({
      open: true,
      title: 'Deactivate Invite',
      message: 'Are you sure you want to deactivate this invite? It will no longer work.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await spacesAPI.deactivateInvite(inviteCode);
          toast.success('Invite deactivated');
          handleViewInvites(invitesDialog.spaceId, invitesDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to deactivate invite');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };



  // Space managers management
  const handleViewManagers = async (spaceId, spaceName) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members-detailed`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      
      const allMembers = data.members || [];
      const managers = allMembers.filter(m => m.role === 'manager');
      const regularMembers = allMembers.filter(m => m.role === 'member');
      
      setManagersDialog({ 
        open: true, 
        spaceId, 
        spaceName, 
        managers, 
        allMembers: regularMembers 
      });
    } catch (error) {
      toast.error('Failed to load managers');
    }
  };

  const handleAddManager = async (spaceId, userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Add Space Manager',
      message: `Promote ${userName} to Space Manager? They can moderate content, approve join requests, and manage members.`,
      variant: 'success',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members/${userId}/promote`, {
            method: 'PUT',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to promote member');
          toast.success(`${userName} promoted to Space Manager`);
          handleViewManagers(spaceId, managersDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.message);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const handleRemoveManager = async (spaceId, userId, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Space Manager',
      message: `Remove ${userName} from Space Manager role?`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${spaceId}/members/${userId}/demote`, {
            method: 'PUT',
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to demote manager');
          toast.success(`${userName} removed from Space Manager role`);
          handleViewManagers(spaceId, managersDialog.spaceName); // Reload
        } catch (error) {
          toast.error(error.message);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
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
      space_type: 'post', allow_member_posts: true, welcome_title: '', welcome_message: ''
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
      allow_member_posts: space.allow_member_posts !== false,
      welcome_title: space.welcome_title || '',
      welcome_message: space.welcome_message || ''
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
      payment_type: tier.payment_type || 'recurring',
      price_inr: tier.price_inr,
      price_usd: tier.price_usd,
      razorpay_plan_id: tier.razorpay_plan_id || '',
      stripe_price_id: tier.stripe_price_id || '',
      duration_days: tier.duration_days || 30,
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

  // Level Management handlers
  const handleCreateLevel = () => {
    setLevelForm({ level_number: '', level_name: '', points_required: '' });
    setLevelDialog({ open: true, mode: 'create', data: null });
  };

  const handleSubmitLevel = async () => {
    try {
      const levelData = {
        level_number: parseInt(levelForm.level_number),
        level_name: levelForm.level_name,
        points_required: parseInt(levelForm.points_required)
      };

      if (!levelData.level_number || !levelData.points_required) {
        toast.error('Level number and points are required');
        return;
      }

      await leaderboardAPI.createLevel(levelData);
      toast.success('Level created successfully!');
      setLevelDialog({ open: false, mode: 'create', data: null });
      loadLevels();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create level');
    }
  };

  const handleEditLevel = async (levelId) => {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    setLevelForm({
      level_number: level.level_number.toString(),
      level_name: level.level_name,
      points_required: level.points_required.toString()
    });
    setLevelDialog({ open: true, mode: 'edit', data: level });
  };

  const handleUpdateLevel = async () => {
    try {
      const levelData = {
        level_name: levelForm.level_name,
        points_required: parseInt(levelForm.points_required)
      };

      if (!levelData.points_required) {
        toast.error('Points required is mandatory');
        return;
      }

      await leaderboardAPI.updateLevel(levelDialog.data.id, levelData);
      toast.success('Level updated successfully!');
      setLevelDialog({ open: false, mode: 'edit', data: null });
      loadLevels();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update level');
    }
  };

  const handleDeleteLevel = async (levelId) => {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    setConfirmDialog({
      open: true,
      title: 'Delete Level',
      message: `Are you sure you want to delete ${level.level_name || `Level ${level.level_number}`}? This will recalculate all user levels.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await leaderboardAPI.deleteLevel(levelId);
          toast.success('Level deleted successfully');
          loadLevels();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to delete level');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F3F4F6' }}>
      {/* Header */}
      <Header />

      <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Left Sidebar Navigation - Fixed/Floating */}
        <div className="w-64 bg-white border-r flex flex-col fixed left-0 top-16 bottom-0" style={{ borderColor: '#E5E7EB', height: 'calc(100vh - 64px)' }}>
          <div className="p-6 border-b flex-shrink-0" style={{ borderColor: '#E5E7EB' }}>
            <h1 className="text-xl font-bold" style={{ color: '#011328' }}>Admin Panel</h1>
            <p className="text-sm mt-1" style={{ color: '#8E8E8E' }}>Manage your platform</p>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'overview' ? 'shadow-sm' : 'hover:bg-gray-50'
                }`}
                style={{
                  backgroundColor: activeTab === 'overview' ? '#E6EFFA' : 'transparent',
                  color: activeTab === 'overview' ? '#0462CB' : '#3B3B3B'
                }}
              >
                <LayoutDashboard className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">Spaces & Groups</p>
                  <p className="text-xs opacity-70">{spaceGroups.length + spaces.length} items</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'users' ? 'shadow-sm' : 'hover:bg-gray-50'
                }`}
                style={{
                  backgroundColor: activeTab === 'users' ? '#E6EFFA' : 'transparent',
                  color: activeTab === 'users' ? '#0462CB' : '#3B3B3B'
                }}
              >
                <UsersIcon className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">Users</p>
                  <p className="text-xs opacity-70">{allUsers.length} members</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('levels')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'levels' ? 'shadow-sm' : 'hover:bg-gray-50'
                }`}
                style={{
                  backgroundColor: activeTab === 'levels' ? '#E6EFFA' : 'transparent',
                  color: activeTab === 'levels' ? '#0462CB' : '#3B3B3B'
                }}
              >
                <Award className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">Levels</p>
                  <p className="text-xs opacity-70">{levels.length} levels</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'subscriptions' ? 'shadow-sm' : 'hover:bg-gray-50'
                }`}
                style={{
                  backgroundColor: activeTab === 'subscriptions' ? '#E6EFFA' : 'transparent',
                  color: activeTab === 'subscriptions' ? '#0462CB' : '#3B3B3B'
                }}
              >
                <CreditCard className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">Subscriptions</p>
                  <p className="text-xs opacity-70">{subscriptionTiers.length} tiers</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('platform-settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'platform-settings' ? 'shadow-sm' : 'hover:bg-gray-50'
                }`}
                style={{
                  backgroundColor: activeTab === 'platform-settings' ? '#E6EFFA' : 'transparent',
                  color: activeTab === 'platform-settings' ? '#0462CB' : '#3B3B3B'
                }}
              >
                <Settings className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">Platform Settings</p>
                  <p className="text-xs opacity-70">Configure platform</p>
                </div>
              </button>
            </div>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto ml-64">
          <div className="p-8">
            {/* Ordering Guide */}
            {activeTab === 'overview' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#011328' }}>Sidebar Structure</h2>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateSpace}
                  className="flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}
                >
                  <Plus className="h-4 w-4" />
                  Add Space
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <Folder className="h-4 w-4" />
                  Add Group
                </Button>
              </div>
            </div>

            {/* Unified List - Shows actual sidebar order */}
            <div className="space-y-3">
              {(() => {
                // Create unified list
                const items = [];
                
                spaceGroups.forEach(group => {
                  items.push({ type: 'group', data: group, order: group.order || 0 });
                });
                
                spaces.filter(s => !s.space_group_id).forEach(space => {
                  items.push({ type: 'space', data: space, order: space.order || 0 });
                });
                
                // Sort by order
                const sortedItems = items.sort((a, b) => a.order - b.order);
                
                if (sortedItems.length === 0) {
                  return (
                    <div className="text-center py-12 bg-white rounded-lg border" style={{ borderColor: '#E5E7EB' }}>
                      <Grid className="h-12 w-12 mx-auto mb-2" style={{ color: '#8E8E8E' }} />
                      <p style={{ color: '#8E8E8E' }}>No spaces or groups yet. Create one to get started!</p>
                    </div>
                  );
                }
                
                return sortedItems.map((item, index) => {
                  if (item.type === 'space') {
                    const space = item.data;
                    const tier = subscriptionTiers.find(t => t.id === space.subscription_tier_id);
                    
                    return (
                      <div key={`space-${space.id}`} className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="text-2xl">{space.icon || '💬'}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {space.order}
                                </span>
                                <h3 className="font-semibold" style={{ color: '#011328' }}>{space.name}</h3>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  Space
                                </span>
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
                                <span>Type: {space.space_type || 'post'}</span>
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
                              onClick={() => handleViewMembers(space.id, space.name)}
                              title="Manage Members"
                            >
                              <UsersIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewManagers(space.id, space.name)}
                              title="Manage Space Managers"
                              style={{ color: '#7C3AED' }}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                            {space.visibility === 'secret' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewInvites(space.id, space.name)}
                                title="Manage Invites"
                                style={{ color: '#10B981' }}
                              >
                                🔗
                              </Button>
                            )}
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
                  } else {
                    // Group
                    const group = item.data;
                    const groupSpaces = spaces.filter(s => s.space_group_id === group.id).sort((a, b) => a.order - b.order);
                    
                    return (
                      <div key={`group-${group.id}`} className="bg-gradient-to-r from-blue-50 to-white rounded-lg p-4 border-2" style={{ borderColor: '#93C5FD' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="text-2xl">{group.icon || '📁'}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {group.order}
                                </span>
                                <h3 className="font-semibold" style={{ color: '#011328' }}>{group.name}</h3>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
                                  Group
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100" style={{ color: '#6B7280' }}>
                                  {groupSpaces.length} {groupSpaces.length === 1 ? 'space' : 'spaces'}
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
                        
                        {/* Nested spaces in group */}
                        {groupSpaces.length > 0 && (
                          <div className="ml-10 space-y-2 mt-3 pt-3 border-t" style={{ borderColor: '#BFDBFE' }}>
                            {groupSpaces.map((space) => {
                              const tier = subscriptionTiers.find(t => t.id === space.subscription_tier_id);
                              
                              return (
                                <div key={space.id} className="bg-white rounded-lg p-3 border" style={{ borderColor: '#E5E7EB' }}>
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-2 flex-1">
                                      <div className="text-xl">{space.icon || '💬'}</div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                            {space.order}
                                          </span>
                                          <h4 className="font-medium text-sm" style={{ color: '#011328' }}>{space.name}</h4>
                                          {getVisibilityBadge(space.visibility)}
                                          {space.auto_join && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                              Auto-Join
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs" style={{ color: '#8E8E8E' }}>{space.description || 'No description'}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewMembers(space.id, space.name)}
                                        title="Manage Members"
                                      >
                                        <UsersIcon className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewManagers(space.id, space.name)}
                                        title="Manage Space Managers"
                                        style={{ color: '#7C3AED' }}
                                      >
                                        <Shield className="h-3 w-3" />
                                      </Button>
                                      {space.visibility === 'secret' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleViewInvites(space.id, space.name)}
                                          title="Manage Invites"
                                          style={{ color: '#10B981', fontSize: '0.875rem' }}
                                        >
                                          🔗
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditSpace(space)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteDialog({ open: true, type: 'space', id: space.id, name: space.name })}
                                        style={{ color: '#EF4444' }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                });
              })()}
            </div>
          </div>
        )}

        {/* Old separate tabs removed - now using unified overview tab */}

        {/* Subscription Tiers Tab */}


        {/* Users Management Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
              <h2 className="text-xl font-bold mb-6" style={{ color: '#011328' }}>Centralized User Management</h2>
              
              <div className="space-y-4">
                {allUsers.map((u) => (
                  <div key={u.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
                    {/* User Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Avatar with Team Badge */}
                        <div className="relative">
                          <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-lg">
                            {u.name?.charAt(0) || '?'}
                          </div>
                          {/* Team Badge */}
                          {u.is_team_member && (
                            <img 
                              src="/team-badge.png" 
                              alt="Team Badge"
                              className="absolute -bottom-1 -right-1"
                              style={{
                                width: '34px',
                                height: '34px',
                                objectFit: 'contain'
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-lg" style={{ color: '#011328' }}>{u.name || 'Unknown'}</span>
                            
                            {/* Role Badges */}
                            {u.role === 'admin' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Global Admin
                              </span>
                            )}
                            {u.is_team_member && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
                                🎩 Team Member
                              </span>
                            )}
                            {u.is_founding_member && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Founding Member
                              </span>
                            )}
                            {u.managed_spaces_count > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Manager of {u.managed_spaces_count} space{u.managed_spaces_count > 1 ? 's' : ''}
                              </span>
                            )}
                            {u.id === user?.id && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                (You)
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-1" style={{ color: '#8E8E8E' }}>{u.email}</p>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Admin Management */}
                        {u.role === 'admin' && u.id !== user?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDemoteFromAdmin(u.id, u.name)}
                            className="border-red-400 text-red-600 hover:bg-red-50"
                          >
                            Demote Admin
                          </Button>
                        )}
                        {u.role === 'learner' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePromoteToAdmin(u.id, u.name)}
                            className="border-green-400 text-green-600 hover:bg-green-50"
                          >
                            Make Admin
                          </Button>
                        )}
                        
                        {/* Team Member Badge */}
                        {u.id !== user?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetTeamMember(u.id, u.name, u.is_team_member)}
                            className={u.is_team_member ? "border-orange-400 text-orange-600 hover:bg-orange-50" : "border-blue-400 text-blue-600 hover:bg-blue-50"}
                          >
                            {u.is_team_member ? 'Remove Team Badge' : 'Grant Team Badge'}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Space Memberships */}
                    {u.memberships && u.memberships.length > 0 && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: '#E5E7EB' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: '#8E8E8E' }}>
                          Space Memberships ({u.memberships.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {u.memberships.map((membership, idx) => (
                            <div 
                              key={idx} 
                              className="px-2 py-1 rounded text-xs border" 
                              style={{ 
                                borderColor: membership.status === 'blocked' ? '#EF4444' : membership.role === 'manager' ? '#F59E0B' : '#D1D5DB',
                                backgroundColor: membership.status === 'blocked' ? '#FEE2E2' : membership.role === 'manager' ? '#FEF3C7' : '#F9FAFB',
                                color: membership.status === 'blocked' ? '#B91C1C' : membership.role === 'manager' ? '#B45309' : '#4B5563'
                              }}
                            >
                              <span className="font-medium">{membership.space_name}</span>
                              {membership.role === 'manager' && ' (Manager)'}
                              {membership.status === 'blocked' && (
                                <span className="ml-1">
                                  {membership.block_type === 'soft' ? '🔒 Soft' : '🚫 Hard'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {allUsers.length === 0 && (
                <p className="text-center py-12" style={{ color: '#8E8E8E' }}>No users found</p>
              )}
            </div>
          </div>
        )}



        {/* Levels Management Tab */}
        {activeTab === 'levels' && (
          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: '#011328' }}>Levels Management</h2>
                <div className="flex gap-2">
                  {levels.length === 0 && (
                    <Button
                      onClick={async () => {
                        try {
                          await leaderboardAPI.seedDefaultLevels();
                          toast.success('Default levels created successfully!');
                          loadLevels();
                        } catch (error) {
                          toast.error(error.response?.data?.detail || 'Failed to seed levels');
                        }
                      }}
                      variant="outline"
                      className="text-blue-600 border-blue-300"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Seed Default Levels
                    </Button>
                  )}
                  <Button
                    onClick={handleCreateLevel}
                    style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}
                    className="text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Level
                  </Button>
                </div>
              </div>

              {levels.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg font-medium mb-2" style={{ color: '#8E8E8E' }}>No levels configured</p>
                  <p className="text-sm mb-4" style={{ color: '#8E8E8E' }}>Click "Seed Default Levels" to create 10 default levels or "Create Level" to add custom levels</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {levels.sort((a, b) => a.level_number - b.level_number).map((level) => (
                    <div key={level.id} className="border rounded-lg p-4 flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white text-xl"
                          style={{
                            background: level.level_number >= 10 ? '#9333EA' :
                                       level.level_number >= 9 ? '#DC2626' :
                                       level.level_number >= 8 ? '#EA580C' :
                                       level.level_number >= 7 ? '#D97706' :
                                       level.level_number >= 6 ? '#0891B2' :
                                       level.level_number >= 5 ? '#059669' :
                                       level.level_number >= 4 ? '#0284C7' :
                                       level.level_number >= 3 ? '#4F46E5' :
                                       level.level_number >= 2 ? '#7C3AED' : '#6B7280'
                          }}
                        >
                          {level.level_number}
                        </div>
                        <div>
                          <p className="font-bold text-lg" style={{ color: '#011328' }}>{level.level_name || `Level ${level.level_number}`}</p>
                          <p className="text-sm" style={{ color: '#8E8E8E' }}>{level.points_required} points required</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLevel(level.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteLevel(level.id)}
                          className="text-red-600 border-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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
                      <div className="flex gap-4 items-baseline">
                        {tier.price_inr && (
                          <p className="text-xl font-bold" style={{ color: '#0462CB' }}>
                            ₹{tier.price_inr}
                          </p>
                        )}
                        {tier.price_usd && (
                          <p className="text-xl font-bold" style={{ color: '#0462CB' }}>
                            ${tier.price_usd}
                          </p>
                        )}
                        <span className="text-sm font-normal" style={{ color: '#8E8E8E' }}>
                          /{tier.duration_days}d ({tier.payment_type})
                        </span>
                      </div>
                      {tier.payment_type === 'recurring' && (
                        <div className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                          {tier.razorpay_plan_id && <span>Razorpay: {tier.razorpay_plan_id}</span>}
                          {tier.razorpay_plan_id && tier.stripe_price_id && <span> | </span>}
                          {tier.stripe_price_id && <span>Stripe: {tier.stripe_price_id}</span>}
                        </div>
                      )}
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


        {/* Platform Settings Tab */}
        {activeTab === 'platform-settings' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2" style={{ color: '#011328' }}>Platform Settings</h2>
              <p className="text-sm" style={{ color: '#8E8E8E' }}>Configure global settings for your community platform</p>
            </div>

            <div className="bg-white rounded-lg p-6 border" style={{ borderColor: '#E5E7EB' }}>
              <div className="space-y-6">
                {/* Branding Section */}
                <div className="pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5" style={{ color: '#0462CB' }} />
                    <h3 className="font-semibold" style={{ color: '#011328' }}>Branding</h3>
                  </div>
                  
                  {/* Logo Upload */}
                  <div className="mb-6">
                    <Label>Community Logo</Label>
                    <div className="flex items-center gap-4 mt-2">
                      {platformSettings.logo ? (
                        <div className="relative">
                          <img 
                            src={platformSettings.logo} 
                            alt="Community Logo" 
                            className="h-16 w-16 object-contain rounded border"
                            style={{ borderColor: '#E5E7EB' }}
                          />
                          <button
                            onClick={handleRemoveLogo}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            title="Remove logo"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded border flex items-center justify-center" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                          <span className="text-xs text-gray-400">No logo</span>
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label htmlFor="logo-upload">
                          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => document.getElementById('logo-upload').click()}>
                            Upload Logo
                          </Button>
                        </label>
                        <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                          Recommended: Square image, max 2MB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Community Name</Label>
                      <Input
                        value={platformSettings.community_name || 'Community'}
                        onChange={(e) => {
                          const newSettings = {
                            ...platformSettings,
                            community_name: e.target.value
                          };
                          setPlatformSettings(newSettings);
                        }}
                        onBlur={() => handleUpdatePlatformSettings(platformSettings)}
                        placeholder="e.g., My Awesome Community"
                      />
                      <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                        This name appears in the header and emails
                      </p>
                    </div>
                    <div>
                      <Label>Primary Brand Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={platformSettings.primary_color || '#0462CB'}
                          onChange={(e) => {
                            const newSettings = {
                              ...platformSettings,
                              primary_color: e.target.value
                            };
                            setPlatformSettings(newSettings);
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={platformSettings.primary_color || '#0462CB'}
                          onChange={(e) => {
                            const newSettings = {
                              ...platformSettings,
                              primary_color: e.target.value
                            };
                            setPlatformSettings(newSettings);
                          }}
                          onBlur={() => handleUpdatePlatformSettings(platformSettings)}
                          placeholder="#0462CB"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                        Used for buttons, links, and accents (refresh page to see changes)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messaging Settings */}
                <div className="pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="h-5 w-5" style={{ color: '#0462CB' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="font-semibold" style={{ color: '#011328' }}>Messaging Controls</h3>
                  </div>
                  
                  <div>
                    <Label>Who can initiate messages?</Label>
                    <select
                      value={messagingSettings.who_can_initiate}
                      onChange={async (e) => {
                        const newValue = e.target.value;
                        setMessagingSettings({ ...messagingSettings, who_can_initiate: newValue });
                        try {
                          await messagingAPI.updateMessagingSettings({ who_can_initiate: newValue });
                          toast.success('Messaging settings updated!');
                        } catch (error) {
                          toast.error('Failed to update messaging settings');
                        }
                      }}
                      className="mt-2 w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#D1D5DB' }}
                    >
                      <option value="all">All Members</option>
                      <option value="paid">Paid Members Only</option>
                      <option value="admins">Admins Only</option>
                    </select>
                    <p className="text-xs mt-2" style={{ color: '#8E8E8E' }}>
                      Controls who can start new conversations. Users can always reply to messages they receive.
                      Individual users can also disable receiving messages in their personal settings.
                    </p>
                  </div>
                </div>

                {/* Payment Requirement Toggle */}
                <div className="flex items-start justify-between pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="h-5 w-5" style={{ color: '#0462CB' }} />
                      <h3 className="font-semibold" style={{ color: '#011328' }}>Paid Community Access</h3>
                    </div>
                    <p className="text-sm" style={{ color: '#8E8E8E' }}>
                      When enabled, users must have an active subscription to access the community. 
                      Admins always have full access.
                    </p>
                    {platformSettings.requires_payment_to_join && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          ⚠️ <strong>Payment Required Mode Active:</strong> New users must subscribe to access the community.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="ml-6">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.requires_payment_to_join}
                        onChange={(e) => {
                          const newSettings = {
                            ...platformSettings,
                            requires_payment_to_join: e.target.checked
                          };
                          handleUpdatePlatformSettings(newSettings);
                        }}
                        className="sr-only peer"
                        disabled={processing}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Information Section */}
                <div className="space-y-3">
                  <h4 className="font-medium" style={{ color: '#011328' }}>How it works:</h4>
                  <ul className="space-y-2 text-sm" style={{ color: '#3B3B3B' }}>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>When disabled: Anyone can register and access the community for free</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">✓</span>
                      <span>When enabled: Users must purchase a subscription to access community features</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5">✓</span>
                      <span>After registration, users without subscription will be redirected to pricing page</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">✓</span>
                      <span>Admins always have full access regardless of subscription status</span>
                    </li>
                  </ul>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 pt-6 border-t" style={{ borderColor: '#E5E7EB' }}>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold" style={{ color: '#0462CB' }}>
                      {subscriptionTiers.filter(t => t.is_active).length}
                    </div>
                    <div className="text-sm" style={{ color: '#8E8E8E' }}>Active Subscription Tiers</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {platformSettings.requires_payment_to_join ? 'ON' : 'OFF'}
                    </div>
                    <div className="text-sm" style={{ color: '#8E8E8E' }}>Payment Requirement</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

          </div>
        </div>
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
              <Label>Order (Sidebar Position)</Label>
              <Input
                type="number"
                value={groupForm.order}
                onChange={(e) => setGroupForm({ ...groupForm, order: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                Controls position in sidebar. Lower numbers appear first (0 = top, 1 = second, etc.)
              </p>
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
                <Label>Order (Sidebar Position)</Label>
                <Input
                  type="number"
                  value={spaceForm.order}
                  onChange={(e) => setSpaceForm({ ...spaceForm, order: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                  Controls position in sidebar. Lower numbers appear first. Spaces & groups share the same ordering.
                </p>
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
              <h4 className="font-semibold mb-3" style={{ color: '#011328' }}>Welcome Message</h4>
              
              <div className="space-y-3">
                <div>
                  <Label>Welcome Title (optional)</Label>
                  <Input
                    value={spaceForm.welcome_title}
                    onChange={(e) => setSpaceForm({ ...spaceForm, welcome_title: e.target.value })}
                    placeholder={`Welcome to ${spaceForm.name || 'this space'}!`}
                  />
                  <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                    Leave blank to use default title
                  </p>
                </div>

                <div>
                  <Label>Welcome Message (optional)</Label>
                  <Textarea
                    value={spaceForm.welcome_message}
                    onChange={(e) => setSpaceForm({ ...spaceForm, welcome_message: e.target.value })}
                    placeholder="Connect, share, and engage with the community!"
                    rows={3}
                  />
                  <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                    Custom message shown at the top of the space
                  </p>
                </div>
              </div>
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
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Name *</Label>
              <Input
                value={tierForm.name}
                onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                placeholder="e.g., Premium Yearly"
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
            
            <div>
              <Label>Payment Type *</Label>
              <select
                value={tierForm.payment_type}
                onChange={(e) => setTierForm({ ...tierForm, payment_type: e.target.value })}
                className="w-full p-2 border rounded"
              >
                <option value="recurring">Recurring Subscription</option>
                <option value="one-time">One-time Payment</option>
              </select>
            </div>

            {tierForm.payment_type === 'one-time' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Price (INR)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tierForm.price_inr || ''}
                      onChange={(e) => setTierForm({ ...tierForm, price_inr: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="999"
                    />
                  </div>
                  <div>
                    <Label>Price (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tierForm.price_usd || ''}
                      onChange={(e) => setTierForm({ ...tierForm, price_usd: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="49"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Razorpay Plan ID (for INR)</Label>
                  <Input
                    value={tierForm.razorpay_plan_id}
                    onChange={(e) => setTierForm({ ...tierForm, razorpay_plan_id: e.target.value })}
                    placeholder="plan_abc123"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Leave empty if not using Razorpay</p>
                </div>
                <div>
                  <Label>Stripe Price ID (for USD)</Label>
                  <Input
                    value={tierForm.stripe_price_id}
                    onChange={(e) => setTierForm({ ...tierForm, stripe_price_id: e.target.value })}
                    placeholder="price_xyz789"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Leave empty if not using Stripe</p>
                </div>
              </>
            )}

            <div>
              <Label>Duration (days) *</Label>
              <Input
                type="number"
                value={tierForm.duration_days}
                onChange={(e) => setTierForm({ ...tierForm, duration_days: parseInt(e.target.value) || 30 })}
                placeholder="30"
              />
              <p className="text-xs text-gray-500 mt-1">Billing cycle for recurring or access duration for one-time (e.g., 30, 365)</p>
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

      {/* Members Dialog - Enhanced with Role Management */}
      <Dialog open={membersDialog.open} onOpenChange={(open) => setMembersDialog({ ...membersDialog, open })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Members of {membersDialog.spaceName}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {membersDialog.members.length === 0 ? (
              <p className="text-center" style={{ color: '#8E8E8E' }}>No members yet</p>
            ) : (
              <div className="space-y-3">
                {membersDialog.members.map((membership) => (
                  <div key={membership.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar with Team Badge */}
                        <div className="relative">
                          <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-lg">
                            {membership.user?.name?.charAt(0) || '?'}
                          </div>
                          {/* Team Badge - Quarter Circle like LinkedIn */}
                          {membership.user?.is_team_member && (
                            <div 
                              className="absolute -bottom-1 -right-1 flex items-center justify-center"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, transparent 50%, #0462CB 50%)',
                                transform: 'rotate(-45deg)'
                              }}
                            >
                              <span 
                                className="text-white font-bold text-[7px] tracking-tight"
                                style={{
                                  transform: 'rotate(45deg) translateY(6px) translateX(6px)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                Team
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-lg" style={{ color: '#011328' }}>{membership.user?.name || 'Unknown'}</span>
                            {membership.user?.role === 'admin' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Global Admin
                              </span>
                            )}
                            {membership.role === 'manager' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Space Manager
                              </span>
                            )}
                            {membership.status === 'blocked' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Blocked
                              </span>
                            )}
                          </div>
                          <p className="text-sm" style={{ color: '#8E8E8E' }}>{membership.user?.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {membership.status === 'blocked' ? (
                        <div className="w-full space-y-2">
                          {membership.block_type && (
                            <p className="text-xs text-gray-600">
                              Block Type: <strong>{membership.block_type === 'soft' ? '🔒 Soft (Can read)' : '🚫 Hard (Cannot read)'}</strong>
                              {membership.block_expires_at && (
                                <span> • Expires: {new Date(membership.block_expires_at).toLocaleString()}</span>
                              )}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleUnblockMember(membersDialog.spaceId, membership.user_id, membership.user?.name);
                              setTimeout(() => handleViewMembers(membersDialog.spaceId, membersDialog.spaceName), 500);
                            }}
                            className="w-full"
                          >
                            Unblock Member
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Space Manager Management */}
                          {membership.role === 'manager' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleDemoteFromManager(membersDialog.spaceId, membership.user_id, membership.user?.name);
                                setTimeout(() => handleViewMembers(membersDialog.spaceId, membersDialog.spaceName), 500);
                              }}
                              className="border-purple-400 text-purple-600"
                            >
                              Remove Manager
                            </Button>
                          ) : membership.user?.role !== 'admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handlePromoteToManager(membersDialog.spaceId, membership.user_id, membership.user?.name);
                                setTimeout(() => handleViewMembers(membersDialog.spaceId, membersDialog.spaceName), 500);
                              }}
                              className="border-purple-400 text-purple-600"
                            >
                              Make Manager
                            </Button>
                          )}

                          {/* Block/Remove Actions */}
                          {membership.user?.role !== 'admin' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  handleSoftBlockMember(membersDialog.spaceId, membership.user_id, membership.user?.name, membersDialog.spaceName);
                                }}
                              >
                                🔒 Block
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  handleRemoveMember(membersDialog.spaceId, membership.user_id, membership.user?.name);
                                }}
                                className="border-red-400 text-red-600"
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersDialog({ ...membersDialog, open: false })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invites Dialog (for Secret Spaces) */}
      <Dialog open={invitesDialog.open} onOpenChange={(open) => setInvitesDialog({ ...invitesDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invites for {invitesDialog.spaceName}</DialogTitle>
            <p className="text-sm text-gray-600">Create and manage invite links for this secret space</p>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Create New Invite */}
            <div className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB', background: '#F9FAFB' }}>
              <h3 className="font-medium mb-3">Create New Invite</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Max Uses (Optional)</label>
                  <Input 
                    id="invite-max-uses"
                    type="number" 
                    placeholder="Unlimited" 
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expires At (Optional)</label>
                  <Input 
                    id="invite-expires"
                    type="datetime-local"
                  />
                </div>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={() => {
                  const maxUses = document.getElementById('invite-max-uses').value;
                  const expires = document.getElementById('invite-expires').value;
                  handleCreateInvite(
                    invitesDialog.spaceId,
                    maxUses ? parseInt(maxUses) : null,
                    expires ? new Date(expires).toISOString() : null
                  );
                }}
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                Create Invite Link
              </Button>
            </div>

            {/* Existing Invites */}
            <div>
              <h3 className="font-medium mb-3">Active Invites</h3>
              {invitesDialog.invites.length === 0 ? (
                <p className="text-center py-4" style={{ color: '#8E8E8E' }}>No active invites</p>
              ) : (
                <div className="space-y-3">
                  {invitesDialog.invites.map((invite) => (
                    <div key={invite.id} className="border rounded-lg p-3" style={{ borderColor: '#E5E7EB' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                              {invite.invite_code}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const link = `${window.location.origin}/join/${invite.invite_code}`;
                                navigator.clipboard.writeText(link);
                                toast.success('Link copied!');
                              }}
                              className="h-6 px-2"
                            >
                              📋 Copy
                            </Button>
                          </div>
                          <div className="text-xs space-y-1" style={{ color: '#8E8E8E' }}>
                            <p>Uses: {invite.uses_count}{invite.max_uses ? ` / ${invite.max_uses}` : ' (unlimited)'}</p>
                            <p>Created: {new Date(invite.created_at).toLocaleDateString()}</p>
                            {invite.expires_at && (
                              <p>Expires: {new Date(invite.expires_at).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeactivateInvite(invite.invite_code)}
                          style={{ color: '#EF4444', borderColor: '#EF4444' }}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvitesDialog({ ...invitesDialog, open: false })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Space Selector Dialog - Assign user as manager to multiple spaces */}
      <Dialog open={spaceSelectDialog.open} onOpenChange={(open) => setSpaceSelectDialog({ ...spaceSelectDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Space Assignments for {spaceSelectDialog.userName}</DialogTitle>
            <p className="text-sm" style={{ color: '#8E8E8E' }}>Select spaces where this user should be a manager</p>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {spaces.map((space) => (
              <div key={space.id} className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
                <div>
                  <p className="font-medium" style={{ color: '#011328' }}>{space.name}</p>
                  <p className="text-xs" style={{ color: '#8E8E8E' }}>{space.description || 'No description'}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // Check if user is already a manager
                    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces/${space.id}/members-detailed`, {
                      credentials: 'include'
                    });
                    const data = await response.json();
                    const membership = data.members.find(m => m.user_id === spaceSelectDialog.userId);
                    
                    if (membership && membership.role === 'manager') {
                      // Demote
                      await handleDemoteFromManager(space.id, spaceSelectDialog.userId, spaceSelectDialog.userName);
                    } else {
                      // Promote
                      await handlePromoteToManager(space.id, spaceSelectDialog.userId, spaceSelectDialog.userName);
                    }
                    // Force reload
                    window.location.reload();
                  }}
                  className={spaceSelectDialog.selectedSpaces.includes(space.id) ? 'bg-purple-100 text-purple-700' : ''}
                >
                  Toggle Manager
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setSpaceSelectDialog({ open: false, userId: null, userName: '', selectedSpaces: [] });
              window.location.reload();
            }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Space Managers Dialog - View and manage managers for a specific space */}
      <Dialog open={managersDialog.open} onOpenChange={(open) => setManagersDialog({ ...managersDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Space Managers of {managersDialog.spaceName}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {/* Current Managers */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3" style={{ color: '#011328' }}>Current Managers</h3>
              {managersDialog.managers.length === 0 ? (
                <p className="text-center py-4" style={{ color: '#8E8E8E' }}>No managers assigned</p>
              ) : (
                <div className="space-y-2">
                  {managersDialog.managers.map((membership) => (
                    <div key={membership.id} className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">
                          {membership.user?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: '#011328' }}>{membership.user?.name || 'Unknown'}</p>
                          <p className="text-sm" style={{ color: '#8E8E8E' }}>{membership.user?.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveManager(managersDialog.spaceId, membership.user_id, membership.user?.name)}
                        style={{ color: '#EF4444', borderColor: '#EF4444' }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Manager */}
            <div>
              <h3 className="font-semibold mb-3" style={{ color: '#011328' }}>Add New Manager</h3>
              {managersDialog.allMembers.length === 0 ? (
                <p className="text-center py-4" style={{ color: '#8E8E8E' }}>No members available to promote</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {managersDialog.allMembers.map((membership) => (
                    <div key={membership.id} className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-between font-semibold">
                          {membership.user?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: '#011328' }}>{membership.user?.name || 'Unknown'}</p>
                          <p className="text-sm" style={{ color: '#8E8E8E' }}>{membership.user?.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddManager(managersDialog.spaceId, membership.user_id, membership.user?.name)}
                        className="border-purple-400 text-purple-600"
                      >
                        Add as Manager
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagersDialog({ ...managersDialog, open: false })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Custom Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.variant === 'success' && (
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {confirmDialog.variant === 'warning' && (
                <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              {confirmDialog.variant === 'danger' && (
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <span>{confirmDialog.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p style={{ color: '#3B3B3B' }}>{confirmDialog.message}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}
              style={
                confirmDialog.variant === 'success' 
                  ? { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white' }
                  : confirmDialog.variant === 'warning'
                  ? { background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'white' }
                  : confirmDialog.variant === 'danger'
                  ? { background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', color: 'white' }
                  : { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Soft Block Dialog */}
      <Dialog open={softBlockDialog.open} onOpenChange={(open) => setSoftBlockDialog({ ...softBlockDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Block Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Block <strong>{softBlockDialog.userName}</strong> from <strong>{softBlockDialog.spaceName}</strong>
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Block Type</label>
                <select 
                  id="blockType"
                  className="w-full p-2 border rounded"
                  defaultValue="hard"
                >
                  <option value="hard">Hard Block (Cannot read or engage)</option>
                  <option value="soft">Soft Block (Can read but cannot engage)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Expiry (Optional)</label>
                <input 
                  type="datetime-local"
                  id="blockExpiry"
                  className="w-full p-2 border rounded"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for permanent block</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSoftBlockDialog({ ...softBlockDialog, open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const blockType = document.getElementById('blockType').value;
                const expiryInput = document.getElementById('blockExpiry').value;
                const expiresAt = expiryInput ? new Date(expiryInput).toISOString() : null;
                handleConfirmSoftBlock(blockType, expiresAt);
              }}
              style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' }}
              className="text-white"
            >
              Block Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Level Dialog (Create/Edit) */}
      <Dialog open={levelDialog.open} onOpenChange={(open) => setLevelDialog({ ...levelDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{levelDialog.mode === 'create' ? 'Create Level' : 'Edit Level'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="level_number">Level Number *</Label>
              <Input
                id="level_number"
                type="number"
                min="1"
                value={levelForm.level_number}
                onChange={(e) => setLevelForm({ ...levelForm, level_number: e.target.value })}
                placeholder="e.g., 11"
                disabled={levelDialog.mode === 'edit'}
              />
              {levelDialog.mode === 'edit' && (
                <p className="text-xs text-gray-500 mt-1">Level number cannot be changed</p>
              )}
            </div>
            <div>
              <Label htmlFor="level_name">Level Name</Label>
              <Input
                id="level_name"
                value={levelForm.level_name}
                onChange={(e) => setLevelForm({ ...levelForm, level_name: e.target.value })}
                placeholder="e.g., Elite"
              />
            </div>
            <div>
              <Label htmlFor="points_required">Points Required *</Label>
              <Input
                id="points_required"
                type="number"
                min="0"
                value={levelForm.points_required}
                onChange={(e) => setLevelForm({ ...levelForm, points_required: e.target.value })}
                placeholder="e.g., 5000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelDialog({ ...levelDialog, open: false })}>
              Cancel
            </Button>
            <Button
              onClick={levelDialog.mode === 'create' ? handleSubmitLevel : handleUpdateLevel}
              style={{ background: 'linear-gradient(135deg, #0462CB 0%, #0284C7 100%)' }}
              className="text-white"
            >
              {levelDialog.mode === 'create' ? 'Create Level' : 'Update Level'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
