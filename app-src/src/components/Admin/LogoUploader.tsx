import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/UI/Button';

interface LogoUploaderProps {
  logoUrl: string;
  onChange: (url: string) => void;
  ownerId: string;
}

const LOGOS_BUCKET = 'thumbs'; // Using thumbs bucket for now, can be changed to 'logos' if needed

export function LogoUploader({ logoUrl, onChange, ownerId }: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const filePath = `logos/${ownerId}/${timestamp}-${sanitizedFileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(LOGOS_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(LOGOS_BUCKET)
        .getPublicUrl(filePath);

      // Update the logo URL
      onChange(urlData.publicUrl);
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
    if (!logoUrl) return;

    try {
      setUploading(true);
      setUploadError(null);

      // Extract the file path from the URL
      const urlParts = logoUrl.split(`/${LOGOS_BUCKET}/`);
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        
        // Delete from storage
        const { error } = await supabase.storage
          .from(LOGOS_BUCKET)
          .remove([filePath]);

        if (error) {
          console.error('Failed to delete from storage:', error);
          // Continue anyway - the URL will be removed from the database
        }
      }

      // Clear the URL
      onChange('');
      setPreviewUrl(null);
    } catch (error) {
      console.error('Remove error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to remove image');
    } finally {
      setUploading(false);
    }
  };

  // Update preview when logoUrl changes externally
  useEffect(() => {
    setPreviewUrl(logoUrl || null);
  }, [logoUrl]);

  return (
    <div className="space-y-4">
      {/* Preview */}
      {previewUrl && (
        <div className="relative group">
          <div className="w-32 h-32 rounded-lg border border-gray-200 bg-white p-2 flex items-center justify-center overflow-hidden">
            <img
              src={previewUrl}
              alt="Logo preview"
              className="max-w-full max-h-full object-contain"
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
            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50 shadow-lg"
            title="Remove logo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Upload Button */}
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
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {uploading ? 'Uploading...' : previewUrl ? 'Change Logo' : 'Upload Logo'}
        </Button>
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
        Upload a logo image to Supabase storage (PNG, JPG, GIF, WebP, max 5MB). Recommended size: 200x200px (square format works best).
      </p>
    </div>
  );
}

