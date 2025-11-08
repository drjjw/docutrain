/**
 * InlineImageEditor - React component for inline editing of cover images
 * Similar to InlineEditor but for image upload/replace functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Pencil, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/UI/Button';

interface InlineImageEditorProps {
  coverUrl?: string;
  documentSlug: string;
  onSave: (url: string) => Promise<boolean>;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode; // The actual image element to wrap
}

const COVERS_BUCKET = 'thumbs';

export function InlineImageEditor({
  coverUrl,
  documentSlug,
  onSave,
  className = '',
  style,
  children,
}: InlineImageEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(coverUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Update preview when coverUrl changes externally
  useEffect(() => {
    setPreviewUrl(coverUrl || null);
  }, [coverUrl]);

  const handleStartEditing = () => {
    setIsEditing(true);
    setUploadError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPreviewUrl(coverUrl || null);
    setUploadError(null);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (PNG, JPG, GIF, WebP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be smaller than 5MB');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      // Use document slug as path prefix
      const filePath = `${documentSlug}/${timestamp}-${sanitizedFileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(COVERS_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(COVERS_BUCKET)
        .getPublicUrl(filePath);

      // Update preview
      setPreviewUrl(urlData.publicUrl);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!coverUrl) return;

    try {
      setUploading(true);
      setUploadError(null);

      // Only try to delete from storage if this is a Supabase storage URL
      const urlParts = coverUrl.split(`/${COVERS_BUCKET}/`);
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        
        // Delete from storage
        const { error } = await supabase.storage
          .from(COVERS_BUCKET)
          .remove([filePath]);

        if (error) {
          console.error('Failed to delete from storage:', error);
          // Continue anyway - the URL will be removed from the database
        }
      }

      // Clear the URL
      setPreviewUrl(null);
    } catch (error) {
      console.error('Remove error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to remove image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (uploading) return;

    try {
      setUploading(true);
      setUploadError(null);

      const success = await onSave(previewUrl || '');
      if (success) {
        setIsEditing(false);
      } else {
        setUploadError('Failed to save image URL');
      }
    } catch (error) {
      console.error('Save error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to save image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Wrapper with hover effect - uses inline styles to avoid layout conflicts */}
      <div
        ref={wrapperRef}
        className={`inline-image-editor-wrapper ${className}`}
        style={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
          ...style 
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {children}
        <button
          type="button"
          className="inline-edit-icon"
          onClick={handleStartEditing}
          title="Click to edit cover image"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            zIndex: 100,
            opacity: isHovering ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: isHovering ? 'auto' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Pencil size={14} />
          <span>Edit</span>
        </button>
      </div>

      {/* Modal for editing */}
      <Modal
        isOpen={isEditing}
        onClose={handleCancel}
        title="Edit Cover Image"
        size="md"
      >
        <div className="space-y-4">
          {/* Preview */}
          {previewUrl && (
            <div className="relative group max-w-full">
              <div className="w-full aspect-[3/2] rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  onError={() => {
                    setPreviewUrl(null);
                    setUploadError('Failed to load image preview');
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50 shadow-lg"
                title="Remove image"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Upload Button */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="sm"
                className="w-full"
              >
                <Upload size={16} className="mr-2" />
                {uploading ? 'Uploading...' : previewUrl ? 'Change Image' : 'Upload Image'}
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {uploadError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{uploadError}</p>
            </div>
          )}

          {/* Help Text */}
          <p className="text-xs text-gray-500">
            Upload an image to Supabase storage (PNG, JPG, GIF, WebP, max 5MB). Recommended size: 1200x630px.
          </p>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

