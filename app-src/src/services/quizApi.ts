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
  quizId?: string;
  questions: QuizQuestion[];
  documentSlug: string;
  documentTitle: string;
  generatedAt: string;
  numQuestions: number;
}

export interface GenerateAndStoreResponse {
  success: boolean;
  quizId: string;
  documentSlug: string;
  numQuestions: number;
  generatedAt: string;
  message: string;
}

export interface RegenerationLimitError {
  error: string;
  message: string;
  lastGenerated: string;
  nextAllowedDate: string;
}

export interface QuizAttemptResponse {
  success: boolean;
  attemptId: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
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
 * Generate quiz questions from document chunks (DEPRECATED - use generateAndStoreQuiz instead)
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

/**
 * Generate and store quiz questions in database
 * 
 * @param documentSlug - Document slug to generate quiz for
 * @param numQuestions - Optional number of questions (auto-calculated if not provided)
 * @returns Promise with generation response
 */
export async function generateAndStoreQuiz(
  documentSlug: string,
  numQuestions?: number
): Promise<GenerateAndStoreResponse> {
  if (!documentSlug) {
    throw new Error('documentSlug is required');
  }
  
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error('Authentication required to generate quizzes');
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
  
  const body: { documentSlug: string; numQuestions?: number } = { documentSlug };
  if (numQuestions !== undefined) {
    body.numQuestions = numQuestions;
  }
  
  const response = await fetch(`${getAPIUrl()}/api/quiz/generate-and-store`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    
    // Check if it's a regeneration limit error
    if (response.status === 429 && errorData.nextAllowedDate) {
      const limitError: RegenerationLimitError = {
        error: errorData.error || 'Regeneration limit exceeded',
        message: errorData.message || 'Quizzes can only be regenerated once per week',
        lastGenerated: errorData.lastGenerated,
        nextAllowedDate: errorData.nextAllowedDate,
      };
      throw limitError;
    }
    
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }
  
  const data: GenerateAndStoreResponse = await response.json();
  return data;
}

/**
 * Get stored quiz questions for a document
 * 
 * @param documentSlug - Document slug to get quiz for
 * @returns Promise with quiz response
 */
export async function getQuiz(documentSlug: string): Promise<QuizResponse> {
  if (!documentSlug) {
    throw new Error('documentSlug is required');
  }
  
  const authToken = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(`${getAPIUrl()}/api/quiz/${encodeURIComponent(documentSlug)}`, {
    method: 'GET',
    headers,
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

/**
 * Submit a quiz attempt with score
 * 
 * @param quizId - Quiz ID
 * @param score - Number of correct answers
 * @returns Promise with attempt response
 */
export async function submitQuizAttempt(
  quizId: string,
  score: number
): Promise<QuizAttemptResponse> {
  if (!quizId) {
    throw new Error('quizId is required');
  }
  
  if (typeof score !== 'number' || score < 0) {
    throw new Error('score must be a non-negative number');
  }
  
  const authToken = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(`${getAPIUrl()}/api/quiz/attempt`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      quizId,
      score,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }
  
  const data: QuizAttemptResponse = await response.json();
  return data;
}

