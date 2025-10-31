import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { learningAPI, spacesAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Play, Book, MessageSquare, StickyNote, ArrowLeft, ArrowRight, Plus, Edit, Trash2, Settings } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';
import { toast } from 'sonner';

export default function LearningSpaceView() {
  const { spaceId } = useParams();
  const { user } = useAuth();
  const [space, setSpace] = useState(null);
  const [sections, setSections] = useState({});
  const [allLessons, setAllLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [progress, setProgress] = useState({ total_lessons: 0, completed_lessons: 0, progress_percentage: 0 });
  const [activeTab, setActiveTab] = useState('overview'); // overview, notes, comments
  const [collapsedSections, setCollapsedSections] = useState({});
  const [notes, setNotes] = useState([]);
  const [comments, setComments] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [watchPercentage, setWatchPercentage] = useState(0);
  const videoRef = useRef(null);
  
  // Admin states
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionsList, setSectionsList] = useState([]);
  const [lessonForm, setLessonForm] = useState({
    section_id: '',
    title: '',
    description: '',
    video_url: '',
    content: '',
    order: 0,
    duration: null
  });
  const [sectionForm, setSectionForm] = useState({
    name: '',
    description: '',
    order: 0
  });
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchSpaceData();
    fetchSections();
    fetchLessons();
    fetchProgress();
  }, [spaceId]);

  useEffect(() => {
    if (selectedLesson) {
      fetchLessonData(selectedLesson.id);
    }
  }, [selectedLesson]);

  const fetchSpaceData = async () => {
    try {
      const response = await spacesAPI.getSpaces();
      const spaceData = response.data.find(s => s.id === spaceId);
      setSpace(spaceData);
    } catch (error) {
      console.error('Error fetching space:', error);
      toast.error('Failed to load space');
    }
  };

  const fetchSections = async () => {
    try {
      const response = await learningAPI.getSections(spaceId);
      setSectionsList(response.data);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const fetchLessons = async () => {
    try {
      const response = await learningAPI.getLessons(spaceId);
      setSections(response.data.sections);
      setAllLessons(response.data.lessons);
      if (response.data.sections_list) {
        setSectionsList(response.data.sections_list);
      }
      
      // Auto-select first lesson if available
      if (response.data.lessons.length > 0 && !selectedLesson) {
        setSelectedLesson(response.data.lessons[0]);
      }
    } catch (error) {
      console.error('Error fetching lessons:', error);
      toast.error('Failed to load lessons');
    }
  };

  const fetchProgress = async () => {
    try {
      const response = await learningAPI.getMyProgress(spaceId);
      setProgress(response.data);
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const fetchLessonData = async (lessonId) => {
    // Fetch notes
    try {
      const notesResponse = await learningAPI.getNotes(lessonId);
      setNotes(notesResponse.data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    }

    // Fetch comments
    try {
      const commentsResponse = await learningAPI.getComments(lessonId);
      setComments(commentsResponse.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    }
  };

  const toggleSection = (sectionName) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const handleLessonClick = (lesson) => {
    setSelectedLesson(lesson);
    setActiveTab('overview');
    setWatchPercentage(lesson.watch_percentage || 0);
  };

  const handleMarkComplete = async () => {
    if (!selectedLesson) return;
    
    try {
      await learningAPI.updateProgress(selectedLesson.id, { completed: true });
      toast.success('Lesson marked as complete!');
      
      // Update local state
      setSelectedLesson(prev => ({ ...prev, completed: true }));
      fetchLessons();
      fetchProgress();
    } catch (error) {
      console.error('Error marking complete:', error);
      toast.error('Failed to mark as complete');
    }
  };

  const handleVideoProgress = async (percentage) => {
    if (!selectedLesson) return;
    
    setWatchPercentage(percentage);
    
    // Update progress every 10% or when reaching 80%
    if (percentage % 10 === 0 || percentage >= 80) {
      try {
        await learningAPI.updateProgress(selectedLesson.id, {
          watch_percentage: percentage,
          completed: percentage >= 80
        });
        
        if (percentage >= 80 && !selectedLesson.completed) {
          toast.success('Lesson automatically marked as complete!');
          fetchLessons();
          fetchProgress();
        }
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.trim() || !selectedLesson) return;
    
    try {
      if (editingNote) {
        await learningAPI.updateNote(selectedLesson.id, editingNote.id, newNote);
        toast.success('Note updated!');
      } else {
        await learningAPI.createNote(selectedLesson.id, newNote);
        toast.success('Note saved!');
      }
      
      setNewNote('');
      setEditingNote(null);
      fetchLessonData(selectedLesson.id);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!selectedLesson) return;
    
    try {
      await learningAPI.deleteNote(selectedLesson.id, noteId);
      toast.success('Note deleted!');
      fetchLessonData(selectedLesson.id);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedLesson) return;
    
    try {
      await learningAPI.addComment(selectedLesson.id, newComment);
      toast.success('Comment posted!');
      setNewComment('');
      fetchLessonData(selectedLesson.id);
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error('Failed to post comment');
    }
  };

  const goToPreviousLesson = () => {
    const currentIndex = allLessons.findIndex(l => l.id === selectedLesson?.id);
    if (currentIndex > 0) {
      setSelectedLesson(allLessons[currentIndex - 1]);
    }
  };

  const goToNextLesson = () => {
    const currentIndex = allLessons.findIndex(l => l.id === selectedLesson?.id);
    if (currentIndex < allLessons.length - 1) {
      setSelectedLesson(allLessons[currentIndex + 1]);
    }
  };

  // Admin Functions
  const handleCreateSection = () => {
    setEditingSection(null);
    setSectionForm({
      name: '',
      description: '',
      order: sectionsList.length
    });
    setShowSectionForm(true);
  };

  const handleEditSection = (section) => {
    setEditingSection(section);
    setSectionForm({
      name: section.name,
      description: section.description || '',
      order: section.order
    });
    setShowSectionForm(true);
  };

  const handleSaveSection = async () => {
    if (!sectionForm.name.trim()) {
      toast.error('Please enter a section name');
      return;
    }

    try {
      if (editingSection) {
        await learningAPI.updateSection(spaceId, editingSection.id, sectionForm);
        toast.success('Section updated successfully!');
      } else {
        await learningAPI.createSection(spaceId, sectionForm);
        toast.success('Section created successfully!');
      }
      
      setShowSectionForm(false);
      setEditingSection(null);
      fetchSections();
      fetchLessons();
    } catch (error) {
      console.error('Error saving section:', error);
      toast.error('Failed to save section');
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Are you sure you want to delete this section? Lessons will be moved to Uncategorized.')) {
      return;
    }

    try {
      await learningAPI.deleteSection(spaceId, sectionId);
      toast.success('Section deleted successfully!');
      fetchSections();
      fetchLessons();
    } catch (error) {
      console.error('Error deleting section:', error);
      toast.error('Failed to delete section');
    }
  };

  const handleCreateLesson = () => {
    setEditingLesson(null);
    setLessonForm({
      section_id: '',
      title: '',
      description: '',
      video_url: '',
      content: '',
      order: allLessons.length,
      duration: null
    });
    setShowLessonForm(true);
  };

  const handleEditLesson = (lesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      section_id: lesson.section_id || '',
      title: lesson.title,
      description: lesson.description || '',
      video_url: lesson.video_url || '',
      content: lesson.content || '',
      order: lesson.order,
      duration: lesson.duration || null
    });
    setShowLessonForm(true);
  };

  const handleSaveLesson = async () => {
    if (!lessonForm.title.trim()) {
      toast.error('Please enter a lesson title');
      return;
    }
    
    if (!lessonForm.section_id) {
      toast.error('Please select a section');
      return;
    }

    try {
      if (editingLesson) {
        await learningAPI.updateLesson(spaceId, editingLesson.id, lessonForm);
        toast.success('Lesson updated successfully!');
      } else {
        await learningAPI.createLesson(spaceId, lessonForm);
        toast.success('Lesson created successfully!');
      }
      
      setShowLessonForm(false);
      setEditingLesson(null);
      fetchLessons();
    } catch (error) {
      console.error('Error saving lesson:', error);
      toast.error('Failed to save lesson');
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson? This will also delete all progress, notes, and comments.')) {
      return;
    }

    try {
      await learningAPI.deleteLesson(spaceId, lessonId);
      toast.success('Lesson deleted successfully!');
      
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson(null);
      }
      
      fetchLessons();
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Failed to delete lesson');
    }
  };

  const extractYouTubeVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  if (!space) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const currentLessonIndex = allLessons.findIndex(l => l.id === selectedLesson?.id);
  const hasPrevious = currentLessonIndex > 0;
  const hasNext = currentLessonIndex < allLessons.length - 1;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Lessons List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Progress Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">{space.name}</h2>
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Admin Settings"
              >
                <Settings className="h-5 w-5 text-gray-600" />
              </button>
            )}
          </div>
          
          {isAdmin && showAdminPanel && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
              <div className="text-xs font-semibold text-blue-900 mb-2">Admin Controls</div>
              <button
                onClick={handleCreateSection}
                className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Create Section
              </button>
              <button
                onClick={handleCreateLesson}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Lesson
              </button>
            </div>
          )}
          
          <div className="text-sm text-gray-600 mb-2">
            Completed {progress.completed_lessons} of {progress.total_lessons} lessons
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress.progress_percentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">{progress.progress_percentage}%</div>
        </div>

        {/* Lessons by Section */}
        <div className="flex-1 overflow-y-auto">
          {allLessons.length === 0 && isAdmin && (
            <div className="p-4 text-center text-gray-500">
              <p className="mb-2">No lessons yet</p>
              <button
                onClick={handleCreateLesson}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create your first lesson
              </button>
            </div>
          )}
          
          {Object.entries(sections).map(([sectionName, sectionLessons]) => {
            // Find the section object to get its ID for edit/delete
            const sectionObj = sectionsList.find(s => s.name === sectionName);
            
            return (
            <div key={sectionName} className="border-b border-gray-200">
              <div className="group relative">
                <button
                  onClick={() => toggleSection(sectionName)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="font-semibold text-sm">{sectionName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{sectionLessons.length} lessons</span>
                    {collapsedSections[sectionName] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                
                {/* Admin Controls for Sections */}
                {isAdmin && showAdminPanel && sectionObj && sectionName !== 'Uncategorized' && (
                  <div className="absolute right-16 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSection(sectionObj);
                      }}
                      className="p-1.5 bg-white hover:bg-purple-50 rounded border border-purple-200 shadow-sm"
                      title="Edit section"
                    >
                      <Edit className="h-3.5 w-3.5 text-purple-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(sectionObj.id);
                      }}
                      className="p-1.5 bg-white hover:bg-red-50 rounded border border-red-200 shadow-sm"
                      title="Delete section"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </button>
                  </div>
                )}
              </div>

              {!collapsedSections[sectionName] && (
                <div>
                  {sectionLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className={`group relative border-l-2 ${
                        selectedLesson?.id === lesson.id ? 'bg-blue-50 border-blue-600' : 'border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => handleLessonClick(lesson)}
                        className="w-full px-4 py-3 pl-8 flex items-start gap-3 hover:bg-gray-50"
                      >
                        {lesson.completed ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{lesson.title}</div>
                          {lesson.duration && (
                            <div className="text-xs text-gray-500">{lesson.duration} min</div>
                          )}
                        </div>
                      </button>
                      
                      {/* Admin Controls */}
                      {isAdmin && showAdminPanel && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditLesson(lesson);
                            }}
                            className="p-1.5 bg-white hover:bg-blue-50 rounded border border-blue-200 shadow-sm"
                            title="Edit lesson"
                          >
                            <Edit className="h-3.5 w-3.5 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLesson(lesson.id);
                            }}
                            className="p-1.5 bg-white hover:bg-red-50 rounded border border-red-200 shadow-sm"
                            title="Delete lesson"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedLesson ? (
          <>
            {/* Lesson Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <h1 className="text-2xl font-bold mb-2">{selectedLesson.title}</h1>
              {selectedLesson.description && (
                <p className="text-gray-600">{selectedLesson.description}</p>
              )}
            </div>

            {/* Video Player */}
            {selectedLesson.video_url && (
              <div className="bg-black">
                <div className="max-w-5xl mx-auto">
                  <iframe
                    ref={videoRef}
                    src={`https://www.youtube.com/embed/${extractYouTubeVideoId(selectedLesson.video_url)}?enablejsapi=1`}
                    title={selectedLesson.title}
                    className="w-full"
                    style={{ aspectRatio: '16/9' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Tabs & Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Tabs */}
              <div className="border-b border-gray-200 px-6">
                <div className="flex gap-6">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-3 font-medium border-b-2 ${
                      activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
                    }`}
                  >
                    <Book className="inline h-4 w-4 mr-2" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`py-3 font-medium border-b-2 ${
                      activeTab === 'notes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
                    }`}
                  >
                    <StickyNote className="inline h-4 w-4 mr-2" />
                    Notes ({notes.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`py-3 font-medium border-b-2 ${
                      activeTab === 'comments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
                    }`}
                  >
                    <MessageSquare className="inline h-4 w-4 mr-2" />
                    Q&A ({comments.length})
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'overview' && (
                  <div className="max-w-3xl">
                    {selectedLesson.content ? (
                      <div
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedLesson.content }}
                      />
                    ) : (
                      <p className="text-gray-500">No content available for this lesson.</p>
                    )}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="max-w-3xl">
                    <h3 className="text-lg font-semibold mb-4">Your Private Notes</h3>
                    
                    {/* Note Editor */}
                    <div className="mb-6">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Write your notes here..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleSaveNote}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          {editingNote ? 'Update Note' : 'Save Note'}
                        </button>
                        {editingNote && (
                          <button
                            onClick={() => {
                              setEditingNote(null);
                              setNewNote('');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-4">
                      {notes.map((note) => (
                        <div key={note.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="whitespace-pre-wrap">{note.note_content}</p>
                          <div className="mt-2 flex gap-2 text-sm">
                            <button
                              onClick={() => {
                                setEditingNote(note);
                                setNewNote(note.note_content);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                      {notes.length === 0 && (
                        <p className="text-gray-500 text-center py-8">No notes yet. Start taking notes to remember key points!</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="max-w-3xl">
                    <h3 className="text-lg font-semibold mb-4">Questions & Discussions</h3>
                    
                    {/* Comment Editor */}
                    <div className="mb-6">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Ask a question or share your thoughts..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                      />
                      <button
                        onClick={handleAddComment}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Post Comment
                      </button>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                              {comment.author?.name?.[0] || 'U'}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold">{comment.author?.name || 'User'}</div>
                              <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
                              <div className="text-xs text-gray-500 mt-2">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {comments.length === 0 && (
                        <p className="text-gray-500 text-center py-8">No comments yet. Be the first to ask a question!</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Navigation */}
              <div className="border-t border-gray-200 p-4 flex items-center justify-between bg-white">
                <button
                  onClick={goToPreviousLesson}
                  disabled={!hasPrevious}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    hasPrevious ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>

                <button
                  onClick={handleMarkComplete}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {selectedLesson.completed ? 'Completed' : 'Mark as Complete'}
                </button>

                <button
                  onClick={goToNextLesson}
                  disabled={!hasNext}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    hasNext ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Play className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p>Select a lesson to start learning</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Lesson Form Modal */}
      {showLessonForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">
                {editingLesson ? 'Edit Lesson' : 'Create New Lesson'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Section Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Section *</label>
                <select
                  value={lessonForm.section_id}
                  onChange={(e) => setLessonForm({ ...lessonForm, section_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a section</option>
                  {sectionsList.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {sectionsList.length === 0 ? (
                    <span className="text-orange-600">Please create a section first using "Create Section" button</span>
                  ) : (
                    'Select which section this lesson belongs to'
                  )}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Lesson Title *</label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  placeholder="e.g., Introduction to React Hooks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  placeholder="Brief description of what students will learn"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                />
              </div>

              {/* YouTube URL */}
              <div>
                <label className="block text-sm font-medium mb-1">YouTube Video URL (optional)</label>
                <input
                  type="url"
                  value={lessonForm.video_url}
                  onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-1">Duration (minutes, optional)</label>
                <input
                  type="number"
                  value={lessonForm.duration || ''}
                  onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="e.g., 15"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>

              {/* Order */}
              <div>
                <label className="block text-sm font-medium mb-1">Order</label>
                <input
                  type="number"
                  value={lessonForm.order}
                  onChange={(e) => setLessonForm({ ...lessonForm, order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">Determines the lesson order (0 = first)</p>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium mb-1">Lesson Content (optional)</label>
                <RichTextEditor
                  content={lessonForm.content}
                  onChange={(content) => setLessonForm({ ...lessonForm, content })}
                  placeholder="Add lesson content, notes, or instructions..."
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLessonForm(false);
                  setEditingLesson(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLesson}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!lessonForm.section_id}
              >
                {editingLesson ? 'Update Lesson' : 'Create Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Section Form Modal */}
      {showSectionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">
                {editingSection ? 'Edit Section' : 'Create New Section'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Section Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Section Name *</label>
                <input
                  type="text"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="e.g., Introduction, Advanced Topics"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                  placeholder="Brief description of this section"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                />
              </div>

              {/* Order */}
              <div>
                <label className="block text-sm font-medium mb-1">Order</label>
                <input
                  type="number"
                  value={sectionForm.order}
                  onChange={(e) => setSectionForm({ ...sectionForm, order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">Determines the section order (0 = first)</p>
              </div>
            </div>

            {/* Form Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSectionForm(false);
                  setEditingSection(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSection}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {editingSection ? 'Update Section' : 'Create Section'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
