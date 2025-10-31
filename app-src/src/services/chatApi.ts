// Type-safe chat API service

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  model: string;
  sessionId: string;
  doc: string | string[];
  passcode?: string;
}

export interface ChatResponse {
  response: string;
  model?: string;
  actualModel?: string;
  conversationId?: string;
  metadata?: {
    chunksUsed?: number;
    retrievalTime?: number;
    responseTime?: number;
    embedding_type?: string;
    embedding_dimensions?: number;
    isMultiDocument?: boolean;
    documentSlugs?: string[];
    chunkSimilarities?: number[];
  };
  error?: string;
  details?: string;
}

export interface StreamingChunk {
  type: 'content' | 'done' | 'error';
  chunk?: string;
  metadata?: ChatResponse['metadata'];
  error?: string;
}

const USE_STREAMING = true; // Feature flag

function getAPIBaseURL(): string {
  // API routes are at the root, not under /app
  // If we're at /app/*, remove /app to get the root
  const pathname = window.location.pathname;
  
  if (pathname.startsWith('/app/')) {
    return window.location.origin;
  }
  
  // Otherwise, use current directory
  const baseDir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return window.location.origin + baseDir;
}

function getAPIUrl(): string {
  return getAPIBaseURL().replace(/\/$/, '');
}

function getEmbeddingType(): string {
  // Check URL parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const embeddingParam = urlParams.get('embedding');
  if (embeddingParam === 'local' || embeddingParam === 'openai') {
    return embeddingParam;
  }

  // Default to openai
  return 'openai';
}

function getAuthToken(): string | null {
  try {
    const sessionData = localStorage.getItem('sb-mlxctdgnojvkgfqldaob-auth-token');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      return session?.access_token || null;
    }
  } catch (error) {
    console.log('⚠️ Could not get JWT token:', error);
  }
  return null;
}

function getPasscode(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('passcode');
}

export async function sendChatMessageStreaming(
  message: string,
  conversationHistory: ChatMessage[],
  selectedModel: string,
  sessionId: string,
  selectedDocument: string | string[]
): Promise<Response> {
  const embeddingType = getEmbeddingType();
  const endpoint = `${getAPIUrl()}/api/chat/stream?embedding=${embeddingType}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('🔑 Including JWT token in streaming chat API request');
  }

  const passcode = getPasscode();
  const requestBody: ChatRequest = {
    message,
    history: conversationHistory.slice(0, -1),
    model: selectedModel,
    sessionId,
    doc: selectedDocument
  };

  if (passcode) {
    requestBody.passcode = passcode;
    console.log('🔐 Including passcode in chat API request');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      cache: 'no-store'
    });

    // For streaming, we need to check if we got a response at all
    // ERR_EMPTY_RESPONSE means the connection was closed immediately
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText.substring(0, 200);
        }
      } catch (e) {
        // Can't parse error, use default
      }
      throw new Error(errorMessage);
    }

    // Check if it's actually a streaming response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      return response;
    } else {
      // Not streaming, try to parse as JSON
      throw new Error('Expected streaming response but got non-streaming content type');
    }
  } catch (fetchError: any) {
    // Handle network errors (ERR_EMPTY_RESPONSE, connection refused, etc.)
    if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
      throw new Error('Connection failed - server may be unavailable or request was rejected. Check server logs.');
    }
    throw fetchError;
  }
}

export async function sendChatMessageNonStreaming(
  message: string,
  conversationHistory: ChatMessage[],
  selectedModel: string,
  sessionId: string,
  selectedDocument: string | string[]
): Promise<ChatResponse> {
  const embeddingType = getEmbeddingType();
  const endpoint = `${getAPIUrl()}/api/chat?embedding=${embeddingType}`;
  const timeoutMs = 60000; // 60 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('🔑 Including JWT token in chat API request');
  }

  try {
    const passcode = getPasscode();
    const requestBody: ChatRequest = {
      message,
      history: conversationHistory.slice(0, -1),
      model: selectedModel,
      sessionId,
      doc: selectedDocument
    };

    if (passcode) {
      requestBody.passcode = passcode;
      console.log('🔐 Including passcode in chat API request');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000} seconds. This may happen with complex queries. Please try again or simplify your question.`);
    }
    throw error;
  }
}

export async function sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[],
  selectedModel: string,
  sessionId: string,
  selectedDocument: string | string[]
): Promise<Response | ChatResponse> {
  if (USE_STREAMING) {
    return sendChatMessageStreaming(message, conversationHistory, selectedModel, sessionId, selectedDocument);
  } else {
    return sendChatMessageNonStreaming(message, conversationHistory, selectedModel, sessionId, selectedDocument);
  }
}

export async function submitRating(conversationId: string, rating: 'thumbs_up' | 'thumbs_down'): Promise<void> {
  const response = await fetch(`${getAPIUrl()}/api/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      rating
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit rating');
  }
}

