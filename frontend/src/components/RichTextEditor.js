import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './ui/button';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Smile, X } from 'lucide-react';
import { useState, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';

export default function RichTextEditor({ content, onChange, placeholder = "Share your thoughts..." }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
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
        class: 'prose max-w-none focus:outline-none min-h-[120px] p-4',
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
      
      // Insert image into editor with a unique id
      editor.chain().focus().insertContent(
        `<img src="${base64}" alt="${file.name}" data-image-id="${imageId}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;" />`
      ).run();
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    e.target.value = '';
  };

  const handleRemoveImage = (imageId) => {
    // Remove from uploaded images
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
    
    // Remove from editor content
    const currentContent = editor.getHTML();
    const updatedContent = currentContent.replace(
      new RegExp(`<img[^>]*data-image-id="${imageId}"[^>]*>`, 'g'),
      ''
    );
    editor.commands.setContent(updatedContent);
    onChange(updatedContent);
  };

  if (!editor) {
    return null;
  }

  return (
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
  );
}
