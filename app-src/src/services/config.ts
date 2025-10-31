// Configuration utilities

export function getAPIBaseURL(): string {
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

export function getAPIUrl(): string {
  return getAPIBaseURL().replace(/\/$/, '');
}

export function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getEmbeddingType(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const embeddingParam = urlParams.get('embedding');
  if (embeddingParam === 'local' || embeddingParam === 'openai') {
    return embeddingParam;
  }
  return 'openai';
}

export function parseDocumentSlugs(): string[] | null {
  const urlParams = new URLSearchParams(window.location.search);
  const docParam = urlParams.get('doc');
  
  if (!docParam) return null;
  
  // Handle comma-separated document slugs
  if (docParam.includes(',')) {
    return docParam.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  
  return [docParam];
}

export function isLocalEnv(): boolean {
  return window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';
}

