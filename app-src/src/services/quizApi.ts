/**
 * Quiz API Service
 * Handles quiz generation API calls
 */

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string]; // Exactly 4 options
  correctAnswer: number; // Index 0-3
}

export interface QuizResponse {
  questions: QuizQuestion[];
  documentSlug: string;
  documentTitle: string;
  generatedAt: string;
  numQuestions: number;
}

/**
 * Get API URL from environment or use default
 */
function getAPIUrl(): string {
  // In development (Vite dev server), API is on different port
  const isDev = import.meta.env.DEV;
  
  if (isDev) {
    // Direct to backend server in development
    return 'http://localhost:3458';
  }
  
  // In production, API routes are at the root, not under /app
  // If we're at /app/chat, we need to go to root for /api routes
  const pathname = window.location.pathname;
  
  // If we're in /app/*, remove /app to get the root
  if (pathname.startsWith('/app/')) {
    return window.location.origin;
  }
  
  // Otherwise, use current directory
  const baseDir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return (window.location.origin + baseDir).replace(/\/$/, '');
}

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
  try {
    const sessionData = localStorage.getItem('sb-mlxctdgnojvkgfqldaob-auth-token');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      return session?.access_token || null;
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Generate quiz questions from document chunks
 * 
 * @param documentSlug - Document slug to generate quiz for
 * @param numQuestions - Number of questions to generate (default: 5)
 * @returns Promise with quiz response
 */
export async function generateQuiz(
  documentSlug: string,
  numQuestions: number = 5
): Promise<QuizResponse> {
  if (!documentSlug) {
    throw new Error('documentSlug is required');
  }
  
  if (numQuestions < 1 || numQuestions > 20) {
    throw new Error('numQuestions must be between 1 and 20');
  }
  
  const authToken = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(`${getAPIUrl()}/api/quiz/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      documentSlug,
      numQuestions,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }
  
  const data: QuizResponse = await response.json();
  
  // Validate response structure
  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('Invalid quiz response format');
  }
  
  return data;
}

