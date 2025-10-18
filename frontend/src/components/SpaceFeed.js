import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { postsAPI, spacesAPI } from '../lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent } from '../components/ui/dialog';
import RichTextEditor from '../components/RichTextEditor';
import CommentEditor from '../components/CommentEditor';
import { Heart, MessageCircle, Send, Loader2, Sparkles, Crown, Users, X, Maximize2 } from 'lucide-react';
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

export default function SpaceFeed({ spaceId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [commentInputRef, setCommentInputRef] = useState(null);

  const config = SPACE_CONFIG[spaceId] || SPACE_CONFIG['introductions'];

  useEffect(() => {
    loadSpaceInfo();
    loadPosts();
  }, [spaceId]);

  const loadSpaceInfo = async () => {
    try {
      const { data: spaces } = await spacesAPI.getSpaces();
      const space = spaces.find(s => s.id === spaceId);
      if (space) {
        setMemberCount(space.member_count || 0);
      }
    } catch (error) {
      console.error('Failed to load space info');
    }
  };

  const loadPosts = async () => {
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
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: '#E6EFFA' }}>
          <Users className="h-5 w-5" style={{ color: '#0462CB' }} />
          <span className="font-semibold" style={{ color: '#011328' }}>{memberCount}</span>
          <span className="text-sm" style={{ color: '#3B3B3B' }}>members</span>
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="mb-6 p-6 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}>
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="h-6 w-6" style={{ color: '#FFB91A' }} />
          <h2 className="text-2xl font-bold">{config.welcomeTitle}</h2>
        </div>
        <p style={{ color: '#E6EFFA' }}>{config.welcomeMessage}</p>
      </div>

      {/* Create Post with Collapsible Rich Editor */}
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

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border" style={{ borderColor: '#D1D5DB' }}>
            <p className="text-lg mb-2" style={{ color: '#8E8E8E' }}>{config.emptyState}</p>
            <p className="text-sm" style={{ color: '#8E8E8E' }}>{config.emptyMessage}</p>
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
