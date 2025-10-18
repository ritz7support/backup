import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';

const MAX_CHARS = 3000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export default function CommentEditor({ value, onChange, onSubmit, placeholder = "Write a comment...", disabled = false }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageData, setImageData] = useState(null);
  const fileInputRef = useRef(null);

  const handleTextChange = (e) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARS) {
      onChange(text, imageData);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create preview and base64 data
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setImagePreview(base64String);
      setImageData(base64String);
      onChange(value, base64String);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageData(null);
    onChange(value, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() && !imageData) return;
    onSubmit(e);
    // Reset editor after submit
    setImagePreview(null);
    setImageData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const remainingChars = MAX_CHARS - value.length;
  const isNearLimit = remainingChars < 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          value={value}
          onChange={handleTextChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            borderColor: '#D1D5DB',
            minHeight: '80px',
            maxHeight: '200px'
          }}
        />
        
        {/* Character Counter */}
        {value.length > 0 && (
          <div 
            className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded"
            style={{ 
              color: isNearLimit ? '#DC2626' : '#6B7280',
              backgroundColor: 'rgba(255, 255, 255, 0.9)'
            }}
          >
            {remainingChars} / {MAX_CHARS}
          </div>
        )}
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-xs max-h-40 rounded-lg border"
            style={{ borderColor: '#D1D5DB' }}
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            id="comment-image-upload"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || !!imagePreview}
            className="flex items-center gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            Add Image
          </Button>
        </div>

        <Button
          type="submit"
          disabled={(!value.trim() && !imageData) || disabled}
          style={{ backgroundColor: '#3B82F6', color: 'white' }}
        >
          {disabled ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </form>
  );
}
