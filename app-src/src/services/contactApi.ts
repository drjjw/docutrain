// Contact API service

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export function getAPIUrl(): string {
  const pathname = window.location.pathname;
  
  if (pathname.startsWith('/app/')) {
    return window.location.origin;
  }
  
  const baseDir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return (window.location.origin + baseDir).replace(/\/$/, '');
}

export async function submitContactForm(data: ContactFormData): Promise<ContactResponse> {
  const apiUrl = `${getAPIUrl()}/api/contact`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    // Check if response has content before trying to parse JSON
    const contentType = response.headers.get('content-type');
    let result: ContactResponse;
    
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      if (text) {
        try {
          result = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError, 'Response text:', text);
          throw new Error('Invalid response from server');
        }
      } else {
        // Empty response body
        throw new Error('Empty response from server');
      }
    } else {
      // Non-JSON response
      const text = await response.text();
      throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
    }
    
    if (!response.ok) {
      throw new Error(result.error || `Server error: ${response.status} ${response.statusText}`);
    }
    
    return result;
  } catch (error) {
    // Handle network errors (connection refused, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error:', error);
      throw new Error('Unable to connect to server. Please make sure the backend server is running.');
    }
    // If it's already an Error with a message, rethrow it
    if (error instanceof Error) {
      throw error;
    }
    // Otherwise wrap it
    throw new Error('Failed to submit contact form. Please try again.');
  }
}

