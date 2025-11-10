/**
 * Quiz API Service
 * Handles quiz generation API calls
 */

import { debugLog } from '@/utils/debug';
import { getAPIUrl } from '@/utils/apiUrl';

export interface QuizQuestion {
  id?: string; // Question ID from database (for tracking which questions were used)
  question: string;
  options: [string, string, string, string, string]; // Exactly 5 options
  correctAnswer: number; // Index 0-4
}

export interface QuizResponse {
  questions: QuizQuestion[];
  questionIds?: string[]; // Array of question IDs used in this attempt
  documentSlug: string;
  documentTitle: string;
  generatedAt: string | null;
  numQuestions: number;
  quizSize?: number; // Number of questions per attempt (default: 5)
  bankSize?: number; // Total questions in the question bank
}

export interface GenerateAndStoreResponse {
  success: boolean;
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
  questionIds?: string[] | null; // Question IDs used in this attempt
  completedAt: string;
}

export interface QuizStatisticsResponse {
  documentSlug: string;
  numQuestions: number;
  generatedAt: string | null;
  totalAttempts: number;
  authenticatedAttempts: number;
  anonymousAttempts: number;
  averageScore: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  totalQuestions: number;
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
  
  const apiUrl = getAPIUrl();
  const fullUrl = `${apiUrl}/api/quiz/generate-and-store`;
  
  debugLog('[QuizAPI] Generating quiz questions:', {
    documentSlug,
    apiUrl,
    fullUrl,
    hostname: window.location.hostname,
    port: window.location.port,
    isDev: import.meta.env.DEV
  });
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
  
  const body: { documentSlug: string; numQuestions?: number } = { documentSlug };
  if (numQuestions !== undefined) {
    body.numQuestions = numQuestions;
  }
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    let errorData: any;
    let errorText: string | null = null;
    
    // Check if this might be a backend connection issue
    if (response.status === 500 || response.status === 502 || response.status === 503) {
      debugLog('[QuizAPI] Backend server error - checking if backend is running...');
      // Try to provide helpful error message
      const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
      if (isDev) {
        console.error('[QuizAPI] ⚠️  Backend server may not be running on port 3458');
        console.error('[QuizAPI] 💡 Try running: npm run dev (in a separate terminal)');
        console.error('[QuizAPI] 💡 Or run both together: npm run dev:all');
      }
    }
    
    // Try to get error details from response
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorText = await response.text();
        debugLog('[QuizAPI] Non-JSON error response:', errorText);
        errorData = { message: errorText || `HTTP ${response.status}` };
      }
    } catch (parseError) {
      debugLog('[QuizAPI] Failed to parse error response:', parseError);
      errorText = await response.text().catch(() => null);
      errorData = { 
        message: errorText || `HTTP ${response.status}: ${response.statusText}`,
        error: 'Failed to parse error response'
      };
    }
    
    debugLog('[QuizAPI] Error response:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      errorText
    });
    
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
    
    // Provide helpful error message
    let errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
    const isDevMode = import.meta.env.DEV || window.location.hostname === 'localhost';
    if (response.status === 500 && isDevMode) {
      errorMessage += ' (Backend server may not be running - check terminal)';
    }
    
    throw new Error(errorMessage);
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
 * @param documentSlug - Document slug
 * @param score - Number of correct answers
 * @param questionIds - Array of question IDs used in this attempt (optional but recommended)
 * @returns Promise with attempt response
 */
export async function submitQuizAttempt(
  documentSlug: string,
  score: number,
  questionIds?: string[]
): Promise<QuizAttemptResponse> {
  if (!documentSlug) {
    throw new Error('documentSlug is required');
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
  
  const body: { documentSlug: string; score: number; questionIds?: string[] } = {
    documentSlug,
    score,
  };
  
  // Include questionIds if provided
  if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
    body.questionIds = questionIds;
  }
  
  const response = await fetch(`${getAPIUrl()}/api/quiz/attempt`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }
  
  const data: QuizAttemptResponse = await response.json();
  return data;
}

/**
 * Get quiz statistics for a document
 * 
 * @param documentSlug - Document slug to get statistics for
 * @returns Promise with statistics response
 */
export async function getQuizStatistics(documentSlug: string): Promise<QuizStatisticsResponse> {
  if (!documentSlug) {
    throw new Error('documentSlug is required');
  }
  
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error('Authentication required to view quiz statistics');
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
  
  const response = await fetch(`${getAPIUrl()}/api/quiz/${encodeURIComponent(documentSlug)}/statistics`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }
  
  const data: QuizStatisticsResponse = await response.json();
  return data;
}

