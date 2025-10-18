import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { postsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import Sidebar from '../components/Sidebar';
import { Heart, MessageCircle, User, ChevronDown, LogOut, Settings } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export default function PostDetailPage() {
  const { spaceId, postId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => {
    fetchSpaces();
    fetchPost();
  }, [postId, spaceId]);

  const fetchSpaces = async () => {
    try {
      const response = await postsAPI.getSpacePosts(spaceId);
      // This will fail, let me use the correct API
      const spacesResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/spaces`, {
        credentials: 'include'
      });
      const spacesData = await spacesResponse.json();
      setSpaces(spacesData || []);
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
    if (!comment.trim()) return;

    setSubmittingComment(true);
    try {
      await postsAPI.addComment(postId, comment);
      setComment('');
      await fetchPost();
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
      {/* Top Header - Same as Dashboard */}
      <header className="bg-white shadow-sm border-b z-50" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold" style={{ color: '#011328' }}>ABCD</h1>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div 
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: '#0462CB' }}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium" style={{ color: '#011328' }}>{user?.name}</span>
                  <ChevronDown className="h-4 w-4" style={{ color: '#6B7280' }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate(`/profile/${user?.id}`)}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin/spaces')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Manage Spaces</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar spaces={spaces} spaceGroups={[]} />

        {/* Post Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#E6EFFA' }}>
          <div className="max-w-4xl mx-auto p-6">
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
          <form onSubmit={handleAddComment} className="mb-6">
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                style={{ backgroundColor: '#3B82F6' }}
              >
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2"
                  style={{
                    borderColor: '#D1D5DB',
                    minHeight: '80px',
                    '--tw-ring-color': '#3B82F6'
                  }}
                  disabled={submittingComment}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    type="submit"
                    disabled={!comment.trim() || submittingComment}
                    style={{ backgroundColor: '#3B82F6' }}
                  >
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </Button>
                </div>
              </div>
            </div>
          </form>

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
                    <p style={{ color: '#4B5563' }}>{comment.content}</p>
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
