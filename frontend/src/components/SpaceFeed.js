import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { postsAPI, spacesAPI } from '../lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent } from '../components/ui/dialog';
import RichTextEditor from '../components/RichTextEditor';
import CommentEditor from '../components/CommentEditor';
import { Heart, MessageCircle, Send, Loader2, Sparkles, Crown, Users, X, Maximize2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const SPACE_CONFIG = {
  'introductions': {
    title: 'Introduction',
    description: 'Share your story with the community',
    placeholder: 'Introduce yourself to the community... 👋',
    welcomeTitle: 'Welcome to Introductions!',
    welcomeMessage: 'Share your story, connect with fellow builders, and let the community know who you are!',
    postButtonText: 'Post Introduction',
    emptyState: 'No introductions yet',
    emptyMessage: 'Be the first to introduce yourself!'
  },
  'ask-doubts': {
    title: 'Ask-Doubts',
    description: 'Get your questions answered',
    placeholder: 'Ask your question... 🤔',
    welcomeTitle: 'Ask Doubts & Get Help!',
    welcomeMessage: 'Have a question? The community is here to help! Ask away and learn together.',
    postButtonText: 'Post Question',
    emptyState: 'No questions yet',
    emptyMessage: 'Be the first to ask a question!'
  },
  'gratitude': {
    title: 'Gratitude',
    description: 'Share appreciation and positive vibes',
    placeholder: 'Share your gratitude... 🙏',
    welcomeTitle: 'Show Your Gratitude!',
    welcomeMessage: 'Appreciate someone who helped you? Share your thanks and spread positivity!',
    postButtonText: 'Post Gratitude',
    emptyState: 'No gratitude posts yet',
    emptyMessage: 'Be the first to share your appreciation!'
  },
  'resources': {
    title: 'Resources',
    description: 'Share helpful resources and learning materials',
    placeholder: 'Share a resource... 📚',
    welcomeTitle: 'Share Knowledge!',
    welcomeMessage: 'Found something useful? Share resources, guides, and learning materials with the community!',
    postButtonText: 'Share Resource',
    emptyState: 'No resources yet',
    emptyMessage: 'Be the first to share a helpful resource!'
  },
  'showcase': {
    title: 'Showcase',
    description: 'Show off your amazing projects',
    placeholder: 'Share your project... 🎨',
    welcomeTitle: 'Showcase Your Work!',
    welcomeMessage: 'Built something awesome? Share your projects, achievements, and creative work with the community!',
    postButtonText: 'Share Project',
    emptyState: 'No showcases yet',
    emptyMessage: 'Be the first to showcase your work!'
  },
  'discussions': {
    title: 'Discussions',
    description: 'Community discussions and debates',
    placeholder: 'Start a discussion... 💬',
    welcomeTitle: 'Join the Discussion!',
    welcomeMessage: 'Share ideas, debate topics, and engage in meaningful conversations with the community!',
    postButtonText: 'Start Discussion',
    emptyState: 'No discussions yet',
    emptyMessage: 'Be the first to start a discussion!'
  }
};

export default function SpaceFeed({ spaceId, isQAMode = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [spaceSettings, setSpaceSettings] = useState({ allow_member_posts: true });
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [commentInputRef, setCommentInputRef] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [joiningSpace, setJoiningSpace] = useState(false);
  const [spaceVisibility, setSpaceVisibility] = useState('public');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [isAdminOrManager, setIsAdminOrManager] = useState(false);

  const config = SPACE_CONFIG[spaceId] || {
    title: spaceSettings.name || 'Space',
    description: spaceSettings.description || 'Community space',
    placeholder: spaceSettings.space_type === 'qa' ? 'Ask your question...' : 'Share something with the community...',
    welcomeTitle: spaceSettings.welcome_title || `Welcome to ${spaceSettings.name || 'this space'}!`,
    welcomeMessage: spaceSettings.welcome_message || 'Connect, share, and engage with the community!',
    postButtonText: spaceSettings.space_type === 'qa' ? 'Post Question' : 'Post',
    emptyState: spaceSettings.space_type === 'qa' ? 'No questions yet' : 'No posts yet',
    emptyMessage: spaceSettings.space_type === 'qa' ? 'Be the first to ask a question!' : 'Be the first to post!'
  };
  // Admins can always post, OR members can post if space allows it
  const canCreatePost = user?.role === 'admin' || (isMember && spaceSettings.allow_member_posts);

  useEffect(() => {
    loadSpaceInfo();
    loadPosts();
  }, [spaceId]);

  // Load join requests when space info is loaded for admins/managers
  useEffect(() => {
    if (user && spaceId && (spaceVisibility === 'private' || spaceVisibility === 'secret')) {
      loadJoinRequests();
    }
  }, [spaceId, spaceVisibility, user]);


  const loadSpaceInfo = async () => {
    try {
      const { data: spaces } = await spacesAPI.getSpaces();
      const space = spaces.find(s => s.id === spaceId);
      
      if (space) {
        setMemberCount(space.member_count || 0);
        setIsMember(space.is_member || false);
        setSpaceVisibility(space.visibility || 'public');
        setHasPendingRequest(space.has_pending_request || false);
        setPendingRequestId(space.pending_request_id || null);
        setSpaceSettings({
          allow_member_posts: space.allow_member_posts !== false,
          space_type: space.space_type || 'post',
          name: space.name,
          description: space.description,
          welcome_title: space.welcome_title,
          welcome_message: space.welcome_message,
          visibility: space.visibility
        });
        
        // Load join requests if this is a private/secret space
        if (user && (space.visibility === 'private' || space.visibility === 'secret')) {
          loadJoinRequests();
        }
      } else {
        // Default to non-member state if space not found
        setIsMember(false);
        setSpaceVisibility('public');
      }
    } catch (error) {
      console.error('Failed to load space info:', error);
      // Default to non-member state on error
      setIsMember(false);
      setSpaceVisibility('public');
    }
  };

  const loadPosts = async () => {
    // For private/secret spaces, only load posts if user is a member or admin
    if ((spaceVisibility === 'private' || spaceVisibility === 'secret') && !isMember && user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await postsAPI.getSpacePosts(spaceId);
      setPosts(data);
    } catch (error) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postContent.trim() || postContent === '<p></p>') return;

    setPosting(true);
    try {
      await postsAPI.createPost({
        space_id: spaceId,
        content: postContent
      });
      setPostContent('');
      setEditorExpanded(false);
      toast.success(`${config.postButtonText} successful! 🎉`);
      loadPosts();
    } catch (error) {
      toast.error('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleJoinSpace = async () => {
    setJoiningSpace(true);
    try {
      if (spaceVisibility === 'public') {
        // Directly join public space
        await spacesAPI.joinSpace(spaceId);
        toast.success('Joined space successfully! 🎉');
        setIsMember(true);
        await loadSpaceInfo();
        // Reload page to refresh sidebar
        setTimeout(() => window.location.reload(), 500);
      } else if (spaceVisibility === 'private' || spaceVisibility === 'secret') {
        // Send join request for private/secret spaces
        await spacesAPI.createJoinRequest(spaceId, '');
        toast.success('Join request sent! 📤');
        setHasPendingRequest(true);
        await loadSpaceInfo();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to join space');
    } finally {
      setJoiningSpace(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequestId) return;
    setJoiningSpace(true);
    try {
      await spacesAPI.cancelJoinRequest(pendingRequestId);
      toast.success('Join request cancelled');
      setHasPendingRequest(false);
      setPendingRequestId(null);
      await loadSpaceInfo();
    } catch (error) {
      toast.error('Failed to cancel request');
    } finally {
      setJoiningSpace(false);
    }
  };

  // Load join requests for admin/manager
  const loadJoinRequests = async () => {
    if (!user || !spaceId) {
      setIsAdminOrManager(false);
      return;
    }
    
    console.log('[SpaceFeed] Loading join requests for space:', spaceId, 'user:', user.email, 'role:', user.role);
    
    // Optimistically try to fetch join requests
    // The backend will return 403 if user doesn't have permission
    try {
      setLoadingRequests(true);
      const { data } = await spacesAPI.getJoinRequests(spaceId);
      console.log('[SpaceFeed] Join requests loaded:', data.length, 'requests');
      
      const pending = data.filter(r => r.status === 'pending');
      setJoinRequests(pending);
      
      // If we successfully got join requests, user has permission
      setIsAdminOrManager(true);
      console.log('[SpaceFeed] User has admin/manager permission, pending requests:', pending.length);
    } catch (error) {
      console.error('[SpaceFeed] Failed to load join requests:', error);
      
      // If 403, user doesn't have permission - this is expected for regular members
      if (error.response?.status === 403) {
        console.log('[SpaceFeed] User does not have admin/manager permission (403)');
        setIsAdminOrManager(false);
        setJoinRequests([]);
      } else {
        // For other errors, check if user is admin and retry
        if (user.role === 'admin') {
          console.warn('[SpaceFeed] Admin user failed to load join requests, setting permission anyway');
          setIsAdminOrManager(true);
        } else {
          setIsAdminOrManager(false);
        }
      }
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (requestId, userName) => {
    try {
      await spacesAPI.approveJoinRequest(requestId);
      toast.success(`${userName} approved! 🎉`);
      loadJoinRequests(); // Reload the list
      loadSpaceInfo(); // Update member count
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId, userName) => {
    try {
      await spacesAPI.rejectJoinRequest(requestId);
      toast.success(`Request from ${userName} rejected`);
      loadJoinRequests(); // Reload the list
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const handleApproveAll = async () => {
    if (!window.confirm(`Approve all ${joinRequests.length} pending requests?`)) return;
    
    try {
      for (const request of joinRequests) {
        await spacesAPI.approveJoinRequest(request.id);
      }
      toast.success(`All requests approved! 🎉`);
      loadJoinRequests();
      loadSpaceInfo();
    } catch (error) {
      toast.error('Failed to approve all requests');
    }
  };



  const handleReact = async (postId) => {
    if (!isMember) {
      toast.error('Please join the space to react to posts');
      return;
    }
    try {
      await postsAPI.reactToPost(postId, '❤️');
      loadPosts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to react');
    }
  };

  const openComments = async (post) => {
    if (!isMember && spaceVisibility !== 'public') {
      toast.error('Please join the space to view comments');
      return;
    }
    setSelectedPost(post);
    setLoadingComments(true);
    try {
      const response = await postsAPI.getComments(post.id);
      setComments(response.data || []);
      setCommentContent('');
      // Focus will be handled by Dialog after it opens
      setTimeout(() => {
        if (commentInputRef) {
          commentInputRef.focus();
        }
      }, 100);
    } catch (error) {
      toast.error('Failed to load comments');
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim() && !commentImage || !selectedPost) return;

    if (!isMember) {
      toast.error('Please join the space to comment');
      return;
    }

    try {
      // Prepare comment content
      let fullCommentContent = commentContent;
      
      // If there's an image, append it to the content
      if (commentImage) {
        fullCommentContent += `<br/><img src="${commentImage}" alt="Comment image" style="max-width: 100%; height: auto; border-radius: 8px; margin-top: 8px;" />`;
      }
      
      const response = await postsAPI.addComment(selectedPost.id, fullCommentContent);
      
      // Create new comment object
      const newComment = {
        id: response.data?.id || Date.now().toString(),
        content: fullCommentContent,
        author_name: user?.name,
        created_at: new Date().toISOString(),
        author: user
      };
      
      // Update comments list directly
      setComments(prevComments => [...prevComments, newComment]);
      
      // Update selected post's comment count
      setSelectedPost(prevPost => ({
        ...prevPost,
        comment_count: (prevPost.comment_count || 0) + 1
      }));
      
      // Update posts list comment count
      setPosts(prevPosts => prevPosts.map(p => 
        p.id === selectedPost.id 
          ? { ...p, comment_count: (p.comment_count || 0) + 1 }
          : p
      ));
      
      // Reset form
      setCommentContent('');
      setCommentImage(null);
      toast.success('Comment added!');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleExpandToFullPage = () => {
    if (selectedPost) {
      // Pass space name to PostDetailPage via route state
      navigate(`/space/${spaceId}/post/${selectedPost.id}`, {
        state: { spaceName: config.title }
      });
      setSelectedPost(null);
    }
  };

  const getReactionCount = (reactions) => {
    if (!reactions || typeof reactions !== 'object') return 0;
    return Object.values(reactions).flat().length;
  };

  const hasUserReacted = (reactions) => {
    if (!reactions || typeof reactions !== 'object') return false;
    return Object.values(reactions).flat().includes(user?.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Space Header with Member Count */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#011328' }}>{config.title}</h1>
          <p className="text-sm" style={{ color: '#8E8E8E' }}>{config.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Member Count */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: '#E6EFFA' }}>
            <Users className="h-5 w-5" style={{ color: '#0462CB' }} />
            <span className="font-semibold" style={{ color: '#011328' }}>{memberCount}</span>
            <span className="text-sm" style={{ color: '#3B3B3B' }}>members</span>
          </div>
          
          {/* Join Requests Button - Visible to all (for now) */}
          {joinRequests.length > 0 && (
            <Button
              onClick={() => setShowRequestsPanel(!showRequestsPanel)}
              className="relative px-4 py-2 rounded-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all animate-pulse"
              style={{ 
                background: 'linear-gradient(135deg, #FF6B6B 0%, #FF5252 100%)',
                border: '2px solid #FFD700'
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Requests</span>
                <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {joinRequests.length}
                </span>
              </div>
            </Button>
          )}
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="mb-6 p-6 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}>
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="h-6 w-6" style={{ color: '#FFB91A' }} />
          <h2 className="text-2xl font-bold">{config.welcomeTitle}</h2>
        </div>
        <p style={{ color: '#E6EFFA' }}>{config.welcomeMessage}</p>
        
        {/* Join/Request Button for Non-Members (excluding admins) */}
        {!isMember && user?.role !== 'admin' && (
          <div className="mt-4">
            {hasPendingRequest ? (
              <div className="flex items-center gap-3">
                <Button
                  disabled
                  className="px-6 py-2 rounded-lg font-semibold bg-white/20 cursor-not-allowed"
                >
                  Request Pending ⏳
                </Button>
                <Button
                  onClick={handleCancelRequest}
                  disabled={joiningSpace}
                  className="px-4 py-2 rounded-lg font-semibold bg-red-500 hover:bg-red-600 text-white"
                >
                  Cancel Request
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleJoinSpace}
                disabled={joiningSpace}
                className="px-6 py-2 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
                style={{ backgroundColor: 'white', color: '#0462CB' }}
              >
                {joiningSpace ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {spaceVisibility === 'public' ? 'Joining...' : 'Sending Request...'}
                  </span>
                ) : (
                  <span>
                    {spaceVisibility === 'public' ? '➕ Join Space' : '🔒 Request to Join'}
                  </span>
                )}
              </Button>
            )}

      {/* Join Requests Notification Banner - Only for Admins/Managers of Private/Secret spaces */}
      {isAdminOrManager && (spaceVisibility === 'private' || spaceVisibility === 'secret') && joinRequests.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-4 border-2 border-yellow-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-yellow-500 rounded-full p-2">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg" style={{ color: '#92400E' }}>
                  {joinRequests.length} Pending Join Request{joinRequests.length > 1 ? 's' : ''}
                </h3>
                <p className="text-sm" style={{ color: '#B45309' }}>
                  {joinRequests.length === 1 ? 'Someone wants' : 'People want'} to join this space
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {joinRequests.length > 1 && (
                <Button
                  onClick={handleApproveAll}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve All
                </Button>
              )}
              <Button
                onClick={() => setShowRequestsPanel(!showRequestsPanel)}
                variant="outline"
                size="sm"
                className="border-yellow-400"
              >
                {showRequestsPanel ? 'Hide' : 'View'}
              </Button>
            </div>
          </div>
          
          {showRequestsPanel && (
            <div className="mt-4 space-y-3">
              {joinRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-lg p-4 border border-yellow-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                      {request.user?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: '#011328' }}>{request.user?.name || 'Unknown'}</p>
                      <p className="text-sm" style={{ color: '#8E8E8E' }}>{request.user?.email}</p>
                      {request.message && (
                        <p className="text-sm mt-1 italic" style={{ color: '#6B7280' }}>"{request.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApproveRequest(request.id, request.user?.name)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      ✓ Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectRequest(request.id, request.user?.name)}
                      size="sm"
                      variant="outline"
                      className="border-red-400 text-red-600 hover:bg-red-50"
                    >
                      ✗ Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

            <p className="mt-2 text-sm" style={{ color: '#E6EFFA' }}>
              {spaceVisibility === 'public' 
                ? 'Join this space to post, comment, and react!' 
                : spaceVisibility === 'private'
                ? 'This is a private space. Your join request will need approval.'
                : 'This is a secret space. Your join request will need approval.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Post with Collapsible Rich Editor */}
      {canCreatePost ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6" style={{ borderColor: '#D1D5DB' }}>
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={user?.picture} />
              <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                {user?.name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
            {!editorExpanded ? (
              <input
                type="text"
                placeholder={config.placeholder}
                onClick={() => setEditorExpanded(true)}
                readOnly
                className="w-full px-4 py-3 rounded-lg border cursor-text hover:border-blue-400 transition-colors"
                style={{ borderColor: '#D1D5DB', color: '#3B3B3B' }}
              />
            ) : (
              <form onSubmit={handleCreatePost}>
                <RichTextEditor
                  content={postContent}
                  onChange={setPostContent}
                  placeholder={config.placeholder}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditorExpanded(false);
                      setPostContent('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={posting || !postContent.trim() || postContent === '<p></p>'}
                    style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
                  >
                    {posting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Posting...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> {config.postButtonText}</>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6 text-center" style={{ borderColor: '#D1D5DB' }}>
          <p style={{ color: '#8E8E8E' }}>
            Only admins can create posts in this space. You can still comment and react to posts!
          </p>
        </div>
      )}

      {/* Posts Feed - Show only for members in private/secret spaces */}
      {(spaceVisibility === 'private' || spaceVisibility === 'secret') && !isMember && user?.role !== 'admin' ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border text-center" style={{ borderColor: '#D1D5DB' }}>
          <div className="mb-4">
            <svg className="h-16 w-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: '#011328' }}>
            {spaceVisibility === 'private' ? 'Private Space' : 'Secret Space'}
          </h3>
          <p className="mb-4" style={{ color: '#8E8E8E' }}>
            This is a {spaceVisibility} space. You need to join to see posts and participate.
          </p>
          {hasPendingRequest ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                disabled
                className="px-6 py-2 rounded-lg font-semibold bg-gray-300 cursor-not-allowed"
              >
                Request Pending ⏳
              </Button>
              <Button
                onClick={handleCancelRequest}
                disabled={joiningSpace}
                variant="outline"
                className="px-4 py-2 rounded-lg"
              >
                Cancel Request
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleJoinSpace}
              disabled={joiningSpace}
              className="px-6 py-2 rounded-lg font-semibold"
              style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
            >
              {joiningSpace ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Request...
                </span>
              ) : (
                <span>🔒 Request to Join</span>
              )}
            </Button>
          )}
        </div>
      ) : (
        <div className={isQAMode ? "space-y-2" : "space-y-4"}>
          {posts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border" style={{ borderColor: '#D1D5DB' }}>
              <p className="text-lg mb-2" style={{ color: '#8E8E8E' }}>{config.emptyState}</p>
              <p className="text-sm" style={{ color: '#8E8E8E' }}>{config.emptyMessage}</p>
            </div>
          ) : isQAMode ? (
          // Q&A Mode - List View (matching screenshot style)
          posts.map((post) => {
            // Extract question text (first line or full content up to 150 chars)
            const questionText = post.content.replace(/<[^>]*>/g, '').substring(0, 150);
            
            return (
              <div 
                key={post.id} 
                className="bg-white rounded-lg p-4 border hover:bg-gray-50 transition-colors cursor-pointer"
                style={{ borderColor: '#E5E7EB' }}
                onClick={() => openComments(post)}
              >
                <div className="flex gap-4 items-start">
                  {/* Avatar */}
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={post.author?.picture} />
                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                      {post.author?.name?.[0]}
                    </AvatarFallback>
                  </Avatar>

                  {/* Question Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-normal text-base mb-1 hover:text-blue-600 transition-colors" style={{ color: '#1F2937' }}>
                      {questionText}
                    </h3>
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                      <span className="font-medium">{post.author?.name}</span>
                      <span>posted {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {/* Stats on Right */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    {/* Votes */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReact(post.id);
                      }}
                      className="flex items-center gap-2 hover:text-red-500 transition-colors"
                    >
                      <Heart 
                        className={`h-5 w-5 ${hasUserReacted(post.reactions) ? 'fill-red-500 text-red-500' : ''}`}
                        style={{ color: hasUserReacted(post.reactions) ? '#EF4444' : '#9CA3AF' }} 
                      />
                      <span className="text-base" style={{ color: '#1F2937' }}>
                        {getReactionCount(post.reactions)}
                      </span>
                    </button>

                    {/* Answers */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openComments(post);
                      }}
                      className="flex items-center gap-2 hover:text-blue-500 transition-colors"
                    >
                      <MessageCircle className="h-5 w-5" style={{ color: '#9CA3AF' }} />
                      <span className="text-base" style={{ color: '#1F2937' }}>
                        {post.comment_count || 0}
                      </span>
                    </button>

                    {/* Menu */}
                    <button 
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 6C10.5523 6 11 5.55228 11 5C11 4.44772 10.5523 4 10 4C9.44772 4 9 4.44772 9 5C9 5.55228 9.44772 6 10 6Z" fill="#9CA3AF"/>
                        <path d="M10 11C10.5523 11 11 10.5523 11 10C11 9.44772 10.5523 9 10 9C9.44772 9 9 9.44772 9 10C9 10.5523 9.44772 11 10 11Z" fill="#9CA3AF"/>
                        <path d="M10 16C10.5523 16 11 15.5523 11 15C11 14.4477 10.5523 14 10 14C9.44772 14 9 14.4477 9 15C9 15.5523 9.44772 16 10 16Z" fill="#9CA3AF"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          // Standard Post Mode - Card View
          posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-md transition-shadow" style={{ borderColor: '#D1D5DB' }}>
              {/* Post Header */}
              <div className="flex items-start gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={post.author?.picture} />
                  <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                    {post.author?.name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold" style={{ color: '#011328' }}>
                      {post.author?.name}
                    </h3>
                    {post.author?.badges?.includes('🎉 Founding 100') && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        <Crown className="h-3 w-3" />
                        Founding
                      </div>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: '#8E8E8E' }}>
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {/* Post Content */}
              <div 
                className="mb-4 prose max-w-none post-content" 
                style={{ color: '#3B3B3B' }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              <style jsx>{`
                .post-content img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 8px;
                  margin: 8px 0;
                  display: block;
                }
              `}</style>

              {/* Post Actions */}
              <div className="flex items-center gap-4 pt-3 border-t" style={{ borderColor: '#E5E7EB' }}>
                <button
                  onClick={() => handleReact(post.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Heart
                    className={`h-5 w-5 ${hasUserReacted(post.reactions) ? 'fill-red-500 text-red-500' : ''}`}
                    style={{ color: hasUserReacted(post.reactions) ? '#EF4444' : '#8E8E8E' }}
                  />
                  <span className="text-sm font-medium" style={{ color: '#3B3B3B' }}>
                    {getReactionCount(post.reactions)}
                  </span>
                </button>
                <button
                  onClick={() => openComments(post)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" style={{ color: '#8E8E8E' }} />
                  <span className="text-sm font-medium" style={{ color: '#3B3B3B' }}>
                    {post.comment_count || 0}
                  </span>
                </button>
              </div>
            </div>
          ))
        )}
        </div>
      )}

      {/* Comments Dialog - Quick Comment Popup */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          {/* Custom Header with Close and Expand buttons */}
          <div className="sticky top-0 bg-white border-b z-10 flex items-center justify-between p-4" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#1F2937' }}>Post & Comments</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExpandToFullPage}
                className="hover:bg-gray-100"
                title="Open in full page"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPost(null)}
                className="hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedPost && (
            <div className="p-6">
              {/* Post Content */}
              <div className="mb-6 pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedPost.author?.picture} />
                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                      {selectedPost.author?.name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold" style={{ color: '#011328' }}>
                      {selectedPost.author?.name}
                    </h4>
                    <p className="text-sm" style={{ color: '#8E8E8E' }}>
                      {formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div 
                  className="prose max-w-none post-content" 
                  style={{ color: '#3B3B3B' }}
                  dangerouslySetInnerHTML={{ __html: selectedPost.content }}
                />
              </div>

              {/* Add Comment Form - Highlighted */}
              <div className="mb-6">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.picture} />
                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                      {user?.name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CommentEditor
                      value={commentContent}
                      onChange={(text, image) => {
                        setCommentContent(text);
                        setCommentImage(image);
                      }}
                      onSubmit={handleAddComment}
                      placeholder="Write a comment..."
                      disabled={false}
                    />
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div>
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#6B7280' }}>
                  Comments ({comments.length})
                </h3>
                <div className="space-y-4">
                  {loadingComments ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#0462CB' }} />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-center py-4" style={{ color: '#8E8E8E' }}>
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.author?.picture} />
                          <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                            {comment.author_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h5 className="font-semibold text-sm mb-1" style={{ color: '#011328' }}>
                              {comment.author_name}
                            </h5>
                            <p className="text-sm" style={{ color: '#3B3B3B' }} dangerouslySetInnerHTML={{ __html: comment.content }} />
                          </div>
                          <p className="text-xs mt-1 ml-3" style={{ color: '#8E8E8E' }}>
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <style jsx>{`
            .post-content img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              margin: 8px 0;
              display: block;
            }
          `}</style>
        </DialogContent>
      </Dialog>
    </div>
  );
}
