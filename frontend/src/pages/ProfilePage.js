import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { membersAPI, adminAPI, authAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import ReferralSection from '../components/ReferralSection';
import { ArrowLeft, Mail, MapPin, Linkedin, Crown, Archive, Trash2, ArchiveRestore, Loader2, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export default function ProfilePage() {
  const { userId } = useParams();
  const { user: currentUser, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    bio: '',
    location: '',
    linkedin: ''
  });

  useEffect(() => {
    loadMember();
  }, [userId]);

  const loadMember = async () => {
    try {
      const { data } = await membersAPI.getMember(userId);
      setMember(data);
      // Initialize edit form with current data
      setEditForm({
        bio: data.bio || '',
        location: data.location || '',
        linkedin: data.linkedin || ''
      });
    } catch (error) {
      toast.error('Failed to load member profile');
      navigate('/members');
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset form
      setEditForm({
        bio: member.bio || '',
        location: member.location || '',
        linkedin: member.linkedin || ''
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    setActionLoading(true);
    try {
      await membersAPI.updateProfile(editForm);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      await checkAuth(); // Update user in context
      loadMember(); // Reload member data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    setActionLoading(true);
    try {
      await adminAPI.archiveMember(userId);
      toast.success(`${member.name} has been archived`);
      navigate('/members');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to archive member');
    } finally {
      setActionLoading(false);
      setShowArchiveDialog(false);
    }
  };

  const handleUnarchive = async () => {
    setActionLoading(true);
    try {
      await adminAPI.unarchiveMember(userId);
      toast.success(`${member.name} has been restored`);
      loadMember();
    } catch (error) {
      toast.error('Failed to restore member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await adminAPI.deleteMember(userId);
      toast.success(`${member.name} has been permanently deleted`);
      navigate('/members');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete member');
    } finally {
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };



  const handlePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await authAPI.updateProfilePicture(reader.result);
          toast.success('Profile picture updated successfully!');
          await checkAuth(); // Update user in context
          loadMember(); // Reload member data to show new picture
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to update profile picture');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to process image');
    }
  };

  const handleRemovePicture = async () => {
    try {
      await authAPI.removeProfilePicture();
      toast.success('Profile picture removed');
      await checkAuth(); // Update user in context
      loadMember(); // Reload member data
    } catch (error) {
      toast.error('Failed to remove profile picture');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin';
  const isOwnProfile = currentUser?.id === userId;
  const isArchived = member?.archived;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }} data-testid="profile-page">
      <div className="max-w-4xl mx-auto p-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/members')}
          className="mb-6"
          style={{ color: '#0462CB' }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
          <div className="flex flex-col md:flex-row gap-8">
            {/* Avatar Section */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <Avatar className="h-32 w-32 mb-4">
                  {member.picture ? (
                    <AvatarImage src={member.picture} />
                  ) : (
                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white', fontSize: '3rem' }}>
                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                {/* Edit Picture Overlay (only for own profile) */}
                {isOwnProfile && !isArchived && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer mb-4">
                    <label htmlFor="profile-picture-upload" className="cursor-pointer text-white text-sm font-medium">
                      📷 Change
                      <input
                        id="profile-picture-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePictureUpload}
                      />
                    </label>
                  </div>
                )}
              </div>
              
              {/* Remove Picture Button (only if user has a picture and it's their own profile) */}
              {isOwnProfile && !isArchived && member.picture && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemovePicture}
                  className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                >
                  Remove Picture
                </Button>
              )}
              
              {isArchived && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mt-2" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                  <Archive className="h-4 w-4" />
                  Archived
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2" style={{ color: '#011328' }}>{member.name}</h1>
                  <p className="text-lg capitalize mb-2" style={{ color: '#8E8E8E' }}>
                    {member.role?.replace('_', ' ')}
                  </p>
                </div>
                
                {/* Edit Button (only for own profile) */}
                {isOwnProfile && !isArchived && (
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={actionLoading}
                          size="sm"
                          style={{ backgroundColor: '#0462CB', color: 'white' }}
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save
                        </Button>
                        <Button
                          onClick={handleEditToggle}
                          disabled={actionLoading}
                          variant="outline"
                          size="sm"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleEditToggle}
                        variant="outline"
                        size="sm"
                        style={{ borderColor: '#0462CB', color: '#0462CB' }}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {member.is_founding_member && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: '#E6EFFA', color: '#0462CB' }}>
                  <Crown className="h-4 w-4" />
                  Founding Member
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2" style={{ color: '#3B3B3B' }}>
                  <Mail className="h-5 w-5" style={{ color: '#8E8E8E' }} />
                  {member.email}
                </div>
                
                {/* Location */}
                {isEditing ? (
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" style={{ color: '#8E8E8E' }} />
                      <Input
                        id="location"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        placeholder="Add your location"
                        className="flex-1"
                      />
                    </div>
                  </div>
                ) : (
                  member.location && (
                    <div className="flex items-center gap-2" style={{ color: '#3B3B3B' }}>
                      <MapPin className="h-5 w-5" style={{ color: '#8E8E8E' }} />
                      {member.location}
                    </div>
                  )
                )}
                
                {/* LinkedIn */}
                {isEditing ? (
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-5 w-5" style={{ color: '#8E8E8E' }} />
                      <Input
                        id="linkedin"
                        value={editForm.linkedin}
                        onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                        placeholder="https://linkedin.com/in/yourprofile"
                        className="flex-1"
                      />
                    </div>
                  </div>
                ) : (
                  member.linkedin && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-5 w-5" style={{ color: '#8E8E8E' }} />
                      <a href={member.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#0462CB' }} className="hover:underline">
                        LinkedIn Profile
                      </a>
                    </div>
                  )
                )}
              </div>

              {/* Bio */}
              {isEditing ? (
                <div className="mb-6">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    className="mt-2"
                  />
                </div>
              ) : (
                member.bio && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Bio</h3>
                    <p style={{ color: '#3B3B3B' }}>{member.bio}</p>
                  </div>
                )
              )}

              {/* Activity Streak */}
              {(member.current_streak > 0 || member.longest_streak > 0) && (
                <div className="mb-6 p-4 rounded-lg border" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#011328' }}>
                    🔥 Activity Streak
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm" style={{ color: '#8E8E8E' }}>Current Streak</p>
                      <p className="text-2xl font-bold" style={{ color: '#0462CB' }}>
                        {member.current_streak || 0} {member.current_streak === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: '#8E8E8E' }}>Longest Streak</p>
                      <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                        {member.longest_streak || 0} {member.longest_streak === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>
                  {member.current_streak >= 7 && (
                    <div className="mt-3 text-sm" style={{ color: '#059669' }}>
                      🎉 Great job! Keep the streak going!
                    </div>
                  )}
                </div>
              )}

              {member.skills && member.skills.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3" style={{ color: '#011328' }}>Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {member.skills.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E6EFFA', color: '#011328' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {member.learning_goals && (
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Learning Goals</h3>
                  <p style={{ color: '#3B3B3B' }}>{member.learning_goals}</p>
                </div>
              )}
            </div>
          </div>

          {/* Admin Actions */}
          {isAdmin && !isOwnProfile && (
            <div className="mt-8 pt-6 border-t flex gap-3" style={{ borderColor: '#D1D5DB' }}>
              {isArchived ? (
                <Button
                  onClick={handleUnarchive}
                  disabled={actionLoading}
                  variant="outline"
                  style={{ borderColor: '#10B981', color: '#10B981' }}
                  className="hover:bg-green-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArchiveRestore className="h-4 w-4 mr-2" />}
                  Restore Member
                </Button>
              ) : (
                <Button
                  onClick={() => setShowArchiveDialog(true)}
                  disabled={actionLoading}
                  variant="outline"
                  style={{ borderColor: '#F59E0B', color: '#F59E0B' }}
                  className="hover:bg-orange-50"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Member
                </Button>
              )}
              
              <Button
                onClick={() => setShowDeleteDialog(true)}
                disabled={actionLoading}
                variant="outline"
                style={{ borderColor: '#DC2626', color: '#DC2626' }}
                className="hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </Button>
            </div>
          )}
        </div>
        
        {/* Referral Section (only for own profile) */}
        {isOwnProfile && !isArchived && (
          <div className="mt-6">
            <ReferralSection />
          </div>
        )}
      </div>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {member?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent {member?.name} from logging in. Their data will be preserved and they can be restored later. All active sessions will be terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} style={{ backgroundColor: '#F59E0B' }}>
              Archive Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete {member?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {member?.name}'s account and all associated data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} style={{ backgroundColor: '#DC2626' }}>
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
