/**
 * Get user-friendly error message from Supabase error
 */
export function getAuthErrorMessage(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message;

  // Common Supabase auth error messages
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password',
    'User already registered': 'An account with this email already exists',
    'Email not confirmed': 'Please check your email to confirm your account',
    'Password should be at least 6 characters': 'Password must be at least 6 characters',
  };

  // Check for exact matches
  if (errorMap[message]) {
    return errorMap[message];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) {
      return value;
    }
  }

  // Default error message
  return message || 'An error occurred. Please try again.';
}

/**
 * Get user-friendly upload error message
 */
export function getUploadErrorMessage(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message;

  if (message.includes('size')) {
    return 'File is too large. Maximum size is 50MB.';
  }
  if (message.includes('type') || message.includes('format')) {
    return 'Invalid file type. Only PDF files are allowed.';
  }
  if (message.includes('permission') || message.includes('authorized')) {
    return 'You do not have permission to upload files.';
  }

  return 'Failed to upload file. Please try again.';
}

