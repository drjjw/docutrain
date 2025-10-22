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
 * Validate file size (max 50MB)
 */
export function validateFileSize(file: File, maxSizeMB = 50): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

/**
 * Get file validation error message
 */
export function getFileValidationError(file: File): string | null {
  if (!validateFileType(file)) {
    return 'Only PDF files are allowed';
  }
  if (!validateFileSize(file)) {
    return 'File size must be less than 50MB';
  }
  return null;
}

