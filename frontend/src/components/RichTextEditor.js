import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import { Button } from './ui/button';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Smile, X, Video } from 'lucide-react';
import { useState, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';

export default function RichTextEditor({ content, onChange, placeholder = "Share your thoughts..." }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-5 my-2',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-5 my-2',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'ml-2',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg my-2',
          style: 'max-width: 100%; height: auto;',
        },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        width: 640,
        height: 360,
        HTMLAttributes: {
          class: 'rounded-lg my-4',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] p-4',
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          // Check if the pasted text is a YouTube URL
          const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
          const match = text.match(youtubeRegex);
          
          if (match) {
            event.preventDefault();
            const videoId = match[4];
            editor?.commands.setYoutubeVideo({
              src: `https://www.youtube.com/watch?v=${videoId}`,
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  const handleBold = () => {
    editor.chain().focus().toggleBold().run();
  };

  const handleItalic = () => {
    editor.chain().focus().toggleItalic().run();
  };

  const handleBulletList = () => {
    editor.chain().focus().toggleBulletList().run();
  };

  const handleOrderedList = () => {
    editor.chain().focus().toggleOrderedList().run();
  };

  const handleAddLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  const handleEmojiSelect = (emojiData) => {
    editor.chain().focus().insertContent(emojiData.emoji).run();
    setShowEmojiPicker(false);
  };

  const handleAddYoutube = () => {
    if (youtubeUrl) {
      // Extract video ID from various YouTube URL formats
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
      const match = youtubeUrl.match(youtubeRegex);
      
      if (match) {
        editor?.commands.setYoutubeVideo({
          src: youtubeUrl,
        });
        setYoutubeUrl('');
        setShowYoutubeInput(false);
      } else {
        alert('Please enter a valid YouTube URL');
      }
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      
      // Add to uploaded images array for preview
      const imageId = Date.now().toString();
      setUploadedImages(prev => [...prev, { id: imageId, src: base64, name: file.name }]);
      
      // Use TipTap's setImage command instead of insertContent
      editor.chain().focus().setImage({ src: base64, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    e.target.value = '';
  };

  const handleRemoveImage = (imageId) => {
    // Remove from uploaded images preview
    const imageToRemove = uploadedImages.find(img => img.id === imageId);
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
    
    // Remove the image from editor by finding and deleting the image node
    if (imageToRemove && editor) {
      const { state } = editor;
      const { doc } = state;
      let imagePos = null;
      
      doc.descendants((node, pos) => {
        if (node.type.name === 'image' && node.attrs.src === imageToRemove.src) {
          imagePos = pos;
          return false;
        }
      });
      
      if (imagePos !== null) {
        editor.chain().focus().deleteRange({ from: imagePos, to: imagePos + 1 }).run();
      }
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Image Previews */}
      {uploadedImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedImages.map((img) => (
            <div key={img.id} className="relative group">
              <img 
                src={img.src} 
                alt={img.name}
                className="w-24 h-24 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(img.id)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all" />
            </div>
          ))}
        </div>
      )}
      
      <div className="border rounded-lg" style={{ borderColor: '#D1D5DB' }}>
        {/* Editor */}
        <EditorContent editor={editor} />
        
        {/* Toolbar at Bottom */}
        <div className="border-t p-2 flex flex-wrap items-center gap-1" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleBold}
            className={editor.isActive('bold') ? 'bg-gray-200' : ''}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleItalic}
            className={editor.isActive('italic') ? 'bg-gray-200' : ''}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleBulletList}
            className={editor.isActive('bulletList') ? 'bg-gray-200' : ''}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleOrderedList}
            className={editor.isActive('orderedList') ? 'bg-gray-200' : ''}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowLinkInput(!showLinkInput)}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            {showLinkInput && (
              <div className="absolute bottom-full left-0 mb-1 p-2 bg-white border rounded-lg shadow-lg z-10 flex gap-2" style={{ minWidth: '250px' }}>
                <input
                  type="url"
                  placeholder="Enter URL..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddLink()}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  style={{ borderColor: '#D1D5DB' }}
                />
                <Button type="button" size="sm" onClick={handleAddLink}>
                  Add
                </Button>
              </div>
            )}
          </div>
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowYoutubeInput(!showYoutubeInput)}
              title="Add YouTube Video"
            >
              <Video className="h-4 w-4" />
            </Button>
            {showYoutubeInput && (
              <div className="absolute bottom-full left-0 mb-1 p-2 bg-white border rounded-lg shadow-lg z-10 flex gap-2" style={{ minWidth: '300px' }}>
                <input
                  type="url"
                  placeholder="Enter YouTube URL..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddYoutube()}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  style={{ borderColor: '#D1D5DB' }}
                />
                <Button type="button" size="sm" onClick={handleAddYoutube}>
                  Add
                </Button>
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-4 w-4" />
            </Button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-1 z-10">
                <EmojiPicker onEmojiClick={handleEmojiSelect} width={300} height={400} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
