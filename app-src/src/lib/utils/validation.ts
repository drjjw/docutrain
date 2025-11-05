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
 * Validate file type for PDF uploads
 */
export function validateFileType(file: File): boolean {
  const allowedTypes = ['application/pdf'];
  return allowedTypes.includes(file.type);
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
  
  console.log('[validation] PROD:', import.meta.env.PROD, 'DEV:', import.meta.env.DEV, 'SuperAdmin:', isSuperAdmin, 'Max size:', maxSize, 'MB');
  
  if (!validateFileType(file)) {
    return 'Only PDF files are allowed';
  }
  if (!validateFileSize(file, undefined, isSuperAdmin)) {
    return `File size must be less than ${maxSize}MB`;
  }
  return null;
}

