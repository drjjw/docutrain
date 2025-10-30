import { supabase } from './client';

const BUCKET_NAME = 'user-documents';

/**
 * Sanitize filename for storage (remove/simplify special characters, limit length)
 */
function sanitizeFileName(fileName: string): string {
  // Remove file extension temporarily
  const lastDot = fileName.lastIndexOf('.');
  const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.substring(lastDot) : '';
  
  // Normalize Unicode characters (convert non-breaking spaces, hyphens, etc.)
  const normalized = name
    .normalize('NFD') // Decompose characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[\u2000-\u206F]/g, '-') // Replace various Unicode spaces/hyphens with regular hyphen
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace any remaining special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  
  // Limit length (200 chars max for filename, keep extension)
  const maxLength = 200 - ext.length;
  const sanitized = normalized.length > maxLength 
    ? normalized.substring(0, maxLength) 
    : normalized;
  
  return sanitized + ext;
}

/**
 * Upload a file to user's storage bucket
 */
export async function uploadFile(userId: string, file: File) {
  // Sanitize filename to avoid special character issues
  const sanitizedFileName = sanitizeFileName(file.name);
  const filePath = `${userId}/${Date.now()}-${sanitizedFileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(path: string) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Get public URL for a file
 */
export function getFileUrl(path: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Get signed URL for private file (expires in 1 hour)
 */
export async function getSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

