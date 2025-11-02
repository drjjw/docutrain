// Type-safe document API service

export interface DocumentInfo {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  welcomeMessage?: string;
  introMessage?: string;
  cover?: string;
  backLink?: string;
  embeddingType?: string;
  active: boolean;
  owner?: string;
  ownerInfo?: {
    slug: string;
    name: string;
    logo_url?: string;
  };
  showDocumentSelector?: boolean;
  metadata?: Record<string, any>;
}

export interface DocumentsResponse {
  documents: DocumentInfo[];
}

export function getAPIUrl(): string {
  // API routes are at the root, not under /app
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

export async function fetchDocuments(options?: {
  doc?: string | string[];
  owner?: string;
  passcode?: string;
}): Promise<DocumentsResponse> {
  const { doc, owner, passcode } = options || {};
  
  // Build API URL
  let apiUrl = `${getAPIUrl()}/api/documents`;
  
  if (owner) {
    apiUrl += `?owner=${encodeURIComponent(owner)}`;
  } else if (doc) {
    const docSlug = Array.isArray(doc) ? doc.join(',') : doc;
    apiUrl += `?doc=${encodeURIComponent(docSlug)}`;
  } else {
    apiUrl += '?doc=smh';
  }
  
  if (passcode) {
    apiUrl += apiUrl.includes('?') ? '&' : '?';
    apiUrl += `passcode=${encodeURIComponent(passcode)}`;
  }
  
  // Fetch from API - no caching
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(apiUrl, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch documents: ${response.status}`);
  }
  
  const data: DocumentsResponse = await response.json();
  return data;
}

export async function fetchDocument(slug: string): Promise<DocumentInfo | null> {
  const response = await fetchDocuments({ doc: slug });
  return response.documents.find(d => d.slug === slug) || null;
}

