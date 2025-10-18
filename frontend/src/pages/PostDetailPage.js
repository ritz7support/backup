import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { postsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import Sidebar from '../components/Sidebar';
import CommentEditor from '../components/CommentEditor';
import { Heart, MessageCircle, User, ChevronDown, LogOut, Settings, Home, Users, Bell, Crown } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export default function PostDetailPage() {
  const { spaceId, postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [spaceGroups, setSpaceGroups] = useState([]);
  const [spaceName, setSpaceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    fetchSpaces();
    fetchSpaceGroups();
    fetchPost();
    // Get space name from route state if available
    if (location.state?.spaceName) {
      setSpaceName(location.state.spaceName);
    }
  }, [postId, spaceId, location.state]);

  const fetchSpaceGroups = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/space-groups`, {
        credentials: 'include'
      });
      const data = await response.json();
      setSpaceGroups(data || []);
    } catch (error) {
      console.error('Error fetching space groups:', error);
      setSpaceGroups([]);
    }
  };

  const fetchSpaces = async () => {
    try {
      const spacesResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces`, {
        credentials: 'include'
      });
      const spacesData = await spacesResponse.json();
      setSpaces(spacesData || []);
      
      // If space name not set from route state, get it from spaces data
      if (!spaceName && spacesData) {
        const currentSpace = spacesData.find(s => s.id === spaceId);
        if (currentSpace) {
          setSpaceName(currentSpace.name);
        }
      }
    } catch (error) {
      console.error('Error fetching spaces:', error);
      setSpaces([]);
    }
  };

  const fetchPost = async () => {
    try {
      setLoading(true);
      // Fetch posts from the space
      const response = await postsAPI.getSpacePosts(spaceId);
      const postsData = response.data;
      
      // Find the specific post
      const foundPost = postsData.find(p => p.id === postId);
      setPost(foundPost);
      
      if (!foundPost) {
        toast.error('Post not found');
      } else {
        // Fetch comments for this post
        try {
          const commentsResponse = await postsAPI.getComments(postId);
          setComments(commentsResponse.data || []);
        } catch (error) {
          console.error('Error fetching comments:', error);
          setComments([]);
        }
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      toast.error('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async () => {
    if (!post) return;
    
    const hasReacted = hasUserReacted(post.reactions);
    
    try {
      await postsAPI.reactToPost(postId, '❤️');
      await fetchPost();
    } catch (error) {
      console.error('Error handling reaction:', error);
      toast.error('Failed to update reaction');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim() && !commentImage) return;

    setSubmittingComment(true);
    try {
      // Prepare comment content
      let commentContent = comment;
      
      // If there's an image, append it to the content
      if (commentImage) {
        commentContent += `<br/><img src="${commentImage}" alt="Comment image" style="max-width: 100%; height: auto; border-radius: 8px; margin-top: 8px;" />`;
      }
      
      const response = await postsAPI.addComment(postId, commentContent);
      
      // Update comments list directly without full page reload
      const newComment = {
        id: response.data?.id || Date.now().toString(),
        content: commentContent,
        author_name: user?.name,
        created_at: new Date().toISOString(),
        author: user
      };
      
      setComments(prevComments => [...prevComments, newComment]);
      
      // Update post comment count
      if (post) {
        setPost(prevPost => ({
          ...prevPost,
          comment_count: (prevPost.comment_count || 0) + 1
        }));
      }
      
      // Reset form
      setComment('');
      setCommentImage(null);
      toast.success('Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
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

  const getSpaceName = () => {
    // Use the dynamically set space name, or fall back to hardcoded mapping
    if (spaceName) return spaceName;
    
    const spaceNames = {
      'introductions': 'Introduction',
      'ask-doubts': 'Ask-Doubts',
      'gratitude': 'Gratitude',
      'resources': 'Resources',
      'showcase': 'Showcase',
      'discussions': 'Discussions'
    };
    return spaceNames[spaceId] || 'Space';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="text-lg">Loading post...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Post not found</p>
          <Button onClick={() => navigate(`/space/${spaceId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Space
          </Button>
        </div>
      </div>
    );
  }

  const hasReacted = hasUserReacted(post.reactions);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header - Same as SpaceView */}
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

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white" style={{ backgroundColor: 'transparent' }}>
              <Bell className="h-5 w-5" />
            </Button>

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
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin/spaces')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Spaces
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar spaces={spaces} spaceGroups={[]} />

        {/* Post Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F3F4F6' }}>
          {/* Back Button - Non-sticky, in document flow */}
          <div className="pt-6 pl-6 pb-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/space/${spaceId}`)}
              className="flex items-center gap-2 hover:bg-white hover:shadow-md bg-white shadow-sm transition-all"
              style={{ borderRadius: '8px' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6"/>
              </svg>
              <span className="font-medium">Back to {getSpaceName()}</span>
            </Button>
          </div>

          <div className="max-w-4xl mx-auto px-6 pb-8">
            {/* Post Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* Post Header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: '#3B82F6' }}
            >
              {post.author_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#1F2937' }}>
                {post.author_name || 'User'}
              </p>
              <p className="text-sm" style={{ color: '#6B7280' }}>
                {new Date(post.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Post Content */}
          <div
            className="mb-4 prose max-w-none post-content"
            style={{ color: '#3B3B3B' }}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Reactions */}
          <div className="flex items-center gap-4 pt-4 border-t" style={{ borderColor: '#E5E7EB' }}>
            <button
              onClick={handleReaction}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                hasReacted
                  ? 'bg-red-50 text-red-600'
                  : 'hover:bg-gray-100'
              }`}
              style={{ color: hasReacted ? '#DC2626' : '#6B7280' }}
            >
              <Heart
                className={`h-5 w-5 ${hasReacted ? 'fill-current' : ''}`}
              />
              <span className="font-medium">{getReactionCount(post.reactions)}</span>
            </button>
            <div className="flex items-center gap-2" style={{ color: '#6B7280' }}>
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">{comments.length}</span>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: '#1F2937' }}>
            Comments ({comments.length})
          </h3>

          {/* Add Comment Form */}
          <div className="mb-6">
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                style={{ backgroundColor: '#3B82F6' }}
              >
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <CommentEditor
                  value={comment}
                  onChange={(text, image) => {
                    setComment(text);
                    setCommentImage(image);
                  }}
                  onSubmit={handleAddComment}
                  placeholder="Write a comment..."
                  disabled={submittingComment}
                />
              </div>
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-4">
            {comments && comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3 pb-4 border-b last:border-b-0" style={{ borderColor: '#E5E7EB' }}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: '#3B82F6' }}
                  >
                    {comment.author_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm" style={{ color: '#1F2937' }}>
                        {comment.author_name || 'User'}
                      </p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p style={{ color: '#4B5563' }} dangerouslySetInnerHTML={{ __html: comment.content }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8" style={{ color: '#9CA3AF' }}>
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>
        </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        .post-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 8px 0;
          display: block;
        }
      `}</style>
    </div>
  );
}
