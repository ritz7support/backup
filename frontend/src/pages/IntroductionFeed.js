import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { postsAPI, spacesAPI } from '../lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import RichTextEditor from '../components/RichTextEditor';
import { Heart, MessageCircle, Send, Loader2, Sparkles, Crown, Users, Lock, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function IntroductionFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentContent, setCommentContent] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [spaceInfo, setSpaceInfo] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isMember, setIsMember] = useState(false);
  const [joiningSpace, setJoiningSpace] = useState(false);

  useEffect(() => {
    loadSpaceInfo();
    loadPosts();
  }, []);

  const loadSpaceInfo = async () => {
    try {
      const { data: spaces } = await spacesAPI.getSpaces();
      const introSpace = spaces.find(s => s.id === 'introductions');
      if (introSpace) {
        setSpaceInfo(introSpace);
        setMemberCount(introSpace.member_count || 0);
        setIsMember(introSpace.is_member);
      }
    } catch (error) {
      console.error('Failed to load space info');
    }
  };

  const loadPosts = async () => {
    try {
      const { data } = await postsAPI.getSpacePosts('introductions');
      setPosts(data);
    } catch (error) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSpace = async () => {
    setJoiningSpace(true);
    try {
      const { data } = await spacesAPI.joinSpace('introductions');
      toast.success(data.message);
      loadSpaceInfo();
      setIsMember(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to join space');
    } finally {
      setJoiningSpace(false);
    }
  };

  const handleLeaveSpace = async () => {
    setJoiningSpace(true);
    try {
      const { data } = await spacesAPI.leaveSpace('introductions');
      toast.success(data.message);
      loadSpaceInfo();
      setIsMember(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to leave space');
    } finally {
      setJoiningSpace(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    setPosting(true);
    try {
      await postsAPI.createPost({
        space_id: 'introductions',
        content: postContent
      });
      setPostContent('');
      toast.success('Introduction posted! 🎉');
      loadPosts();
    } catch (error) {
      toast.error('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (postId) => {
    try {
      await postsAPI.reactToPost(postId, '❤️');
      loadPosts();
    } catch (error) {
      toast.error('Failed to react');
    }
  };

  const openComments = async (post) => {
    setSelectedPost(post);
    setLoadingComments(true);
    try {
      const { data } = await postsAPI.getComments(post.id);
      setComments(data);
    } catch (error) {
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim() || !selectedPost) return;

    try {
      await postsAPI.addComment(selectedPost.id, commentContent);
      setCommentContent('');
      
      // Reload comments
      const { data } = await postsAPI.getComments(selectedPost.id);
      setComments(data);
      
      // Update post comment count
      loadPosts();
      toast.success('Comment added!');
    } catch (error) {
      toast.error('Failed to add comment');
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
          <h1 className="text-2xl font-bold" style={{ color: '#011328' }}>Introduction</h1>
          <p className="text-sm" style={{ color: '#8E8E8E' }}>Share your story with the community</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: '#E6EFFA' }}>
            <Users className="h-5 w-5" style={{ color: '#0462CB' }} />
            <span className="font-semibold" style={{ color: '#011328' }}>{memberCount}</span>
            <span className="text-sm" style={{ color: '#3B3B3B' }}>members</span>
          </div>
          {!isMember ? (
            <Button
              onClick={handleJoinSpace}
              disabled={joiningSpace}
              style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
            >
              {joiningSpace ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" /> Join Space</>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleLeaveSpace}
              disabled={joiningSpace}
              variant="outline"
              style={{ borderColor: '#DC2626', color: '#DC2626' }}
            >
              {joiningSpace ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Leaving...</>
              ) : (
                <><UserMinus className="h-4 w-4 mr-2" /> Leave Space</>
              )}
            </Button>
          )}
        </div>
      </div>

      {!isMember ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border text-center" style={{ borderColor: '#D1D5DB' }}>
          <Lock className="h-12 w-12 mx-auto mb-4" style={{ color: '#8E8E8E' }} />
          <h3 className="text-xl font-bold mb-2" style={{ color: '#011328' }}>Join to Participate</h3>
          <p className="mb-6" style={{ color: '#3B3B3B' }}>
            Join this space to share your introduction and connect with other members.
          </p>
          <Button
            onClick={handleJoinSpace}
            disabled={joiningSpace}
            style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
          >
            {joiningSpace ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining...</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" /> Join Space</>
            )}
          </Button>
        </div>
      ) : (
        <>
          {/* Welcome Banner */}
          <div className="mb-6 p-6 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}>
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="h-6 w-6" style={{ color: '#FFB91A' }} />
              <h2 className="text-2xl font-bold">Welcome to Introductions!</h2>
            </div>
            <p style={{ color: '#E6EFFA' }}>
              Share your story, connect with fellow builders, and let the community know who you are!
            </p>
          </div>

          {/* Create Post with Rich Editor */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6" style={{ borderColor: '#D1D5DB' }}>
            <div className="flex gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={user?.picture} />
                <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                  {user?.name?.[0]}
                </AvatarFallback>
              </Avatar>
              <form onSubmit={handleCreatePost} className="flex-1">
                <RichTextEditor
                  content={postContent}
                  onChange={setPostContent}
                  placeholder="Introduce yourself to the community... 👋"
                />
                <div className="flex justify-end mt-3">
                  <Button
                    type="submit"
                    disabled={posting || !postContent.trim() || postContent === '<p></p>'}
                    style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
                  >
                    {posting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Posting...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Post Introduction</>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border" style={{ borderColor: '#D1D5DB' }}>
            <p className="text-lg mb-2" style={{ color: '#8E8E8E' }}>No introductions yet</p>
            <p className="text-sm" style={{ color: '#8E8E8E' }}>Be the first to introduce yourself!</p>
          </div>
        ) : (
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
                className="mb-4 prose max-w-none" 
                style={{ color: '#3B3B3B' }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

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

      {/* Comments Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div>
              {/* Original Post */}
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
                  className="prose max-w-none" 
                  style={{ color: '#3B3B3B' }}
                  dangerouslySetInnerHTML={{ __html: selectedPost.content }}
                />
              </div>

              {/* Comments List */}
              <div className="space-y-4 mb-6">
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
                          {comment.author?.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h5 className="font-semibold text-sm mb-1" style={{ color: '#011328' }}>
                            {comment.author?.name}
                          </h5>
                          <p className="text-sm" style={{ color: '#3B3B3B' }}>
                            {comment.content}
                          </p>
                        </div>
                        <p className="text-xs mt-1 ml-3" style={{ color: '#8E8E8E' }}>
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                    {user?.name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                  <Button
                    type="submit"
                    disabled={!commentContent.trim()}
                    style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
