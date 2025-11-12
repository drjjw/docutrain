/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Returns error message if invalid, null if valid
 */
export function validatePassword(password: string): string | null {
  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  return null;
}

/**
 * Validate passwords match
 */
export function validatePasswordMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}

/**
 * Validate file type for PDF and audio uploads
 */
export function validateFileType(file: File): boolean {
  const allowedTypes = [
    'application/pdf',
    'audio/mpeg',
    'audio/wav',
    'audio/x-m4a',
    'audio/m4a',
    'audio/mp4', // Some systems use this for m4a files
    'audio/ogg',
    'audio/flac',
    'audio/aac',
    'audio/x-aac' // Alternative AAC MIME type
  ];
  
  // Get file extension first (we'll use this for fallback)
  // Handle filenames with or without extensions, and multiple dots
  const lastDotIndex = file.name.lastIndexOf('.');
  const fileExtension = lastDotIndex > 0 && lastDotIndex < file.name.length - 1
    ? file.name.substring(lastDotIndex + 1).toLowerCase().trim()
    : null;
  const allowedExtensions = ['pdf', 'mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'];
  
  // Check MIME type first (if it exists and is not empty)
  if (file.type && file.type.trim()) {
    const mimeType = file.type.trim();
    
    // Check exact match
    if (allowedTypes.includes(mimeType)) {
      console.log('[validateFileType] Accepted by MIME type exact match:', mimeType);
      return true;
    }
    
    // Check if MIME type starts with audio/ (catch-all for audio files)
    if (mimeType.startsWith('audio/')) {
      console.log('[validateFileType] Accepted by MIME type prefix:', mimeType);
      return true;
    }
  }
  
  // Fallback: check file extension (some browsers don't set MIME type correctly)
  if (fileExtension && allowedExtensions.includes(fileExtension)) {
    console.log('[validateFileType] Accepted by file extension:', fileExtension);
    return true;
  }
  
  console.log('[validateFileType] REJECTED:', {
    fileName: file.name,
    fileType: file.type,
    extension: fileExtension,
    allowedExtensions: allowedExtensions
  });
  
  return false;
}

/**
 * Validate file size (environment-aware: 200MB dev, 50MB prod, 75MB for superadmin)
 */
export function validateFileSize(file: File, maxSizeMB?: number, isSuperAdmin?: boolean): boolean {
  let defaultMaxSize: number;
  
  if (isSuperAdmin) {
    // Superadmin: 75MB in production, 200MB in development
    defaultMaxSize = import.meta.env.PROD ? 75 : 200;
  } else {
    // Regular users: 50MB in production, 200MB in development
    defaultMaxSize = import.meta.env.PROD ? 50 : 200;
  }
  
  const maxSize = maxSizeMB ?? defaultMaxSize;
  const maxSizeBytes = maxSize * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

/**
 * Get file validation error message
 */
export function getFileValidationError(file: File, isSuperAdmin?: boolean): string | null {
  const maxSize = isSuperAdmin 
    ? (import.meta.env.PROD ? 75 : 200)
    : (import.meta.env.PROD ? 50 : 200);
  
  // Debug logging to help diagnose validation issues
  console.log('[File Validation Debug]', {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    extension: file.name.split('.').pop()?.toLowerCase(),
    isValidType: validateFileType(file),
    isValidSize: validateFileSize(file, undefined, isSuperAdmin)
  });
  
  if (!validateFileType(file)) {
    return 'Only PDF and audio files (MP3, WAV, M4A, OGG, FLAC, AAC) are allowed';
  }
  if (!validateFileSize(file, undefined, isSuperAdmin)) {
    return `File size must be less than ${maxSize}MB`;
  }
  return null;
}

