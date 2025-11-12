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
    'email rate limit exceeded': 'Email sending rate limit exceeded. Please wait an hour before requesting another email. You may have already received a confirmation email - please check your inbox and spam folder.',
  };

  // Check for exact matches
  if (errorMap[message]) {
    return errorMap[message];
  }

  // Check for partial matches (case insensitive)
  const lowerMessage = message.toLowerCase();
  for (const [key, value] of Object.entries(errorMap)) {
    if (lowerMessage.includes(key.toLowerCase())) {
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
    return 'Invalid file type. Only PDF and audio files (MP3, WAV, M4A, OGG, FLAC, AAC) are allowed.';
  }
  if (message.includes('permission') || message.includes('authorized')) {
    return 'You do not have permission to upload files.';
  }

  return 'Failed to upload file. Please try again.';
}

