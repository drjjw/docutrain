import { supabase } from './client';
import { getUserPermissions } from './permissions';
import type { Document, DocumentWithOwner, Owner, UserWithRoles, UserRole } from '@/types/admin';

/**
 * Get all documents based on user permissions
 * Super admins see all documents, owner admins see only their owner group's documents
 */
export async function getDocuments(userId: string): Promise<DocumentWithOwner[]> {
  // Get user permissions to determine access level
  const permissions = await getUserPermissions(userId);
  
  const query = supabase
    .from('documents')
    .select(`
      id,
      slug,
      title,
      subtitle,
      back_link,
      welcome_message,
      pdf_filename,
      pdf_subdirectory,
      embedding_type,
      year,
      active,
      metadata,
      created_at,
      updated_at,
      category,
      owner,
      owner_id,
      cover,
      intro_message,
      downloads,
      chunk_limit_override,
      show_document_selector,
      access_level,
      passcode,
      uploaded_by_user_id,
      owners(*)
    `)
    .order('created_at', { ascending: false });

  // If not super admin, filter by owner groups OR user's own documents
  if (!permissions.is_super_admin) {
    const ownerIds = permissions.owner_groups.map(og => og.owner_id);
    
    // Fetch all documents (RLS will filter based on SELECT policies)
    const { data: allDocs, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch documents: ${fetchError.message}`);
    }

    // Filter client-side: documents from owner groups OR user's own documents
    // RLS already filters based on user_has_document_access, but we need to also include
    // user's own documents even if they don't have owner group access
    const filtered = (allDocs || []).filter(doc => {
      // Documents from owner groups
      if (doc.owner_id && ownerIds.includes(doc.owner_id)) {
        return true;
      }
      // User's own documents (owner_id IS NULL and metadata.user_id matches)
      if (!doc.owner_id && doc.metadata?.user_id === userId) {
        return true;
      }
      return false;
    });

    return filtered as DocumentWithOwner[];
  }

  // Super admin sees all documents
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data || []) as DocumentWithOwner[];
}

/**
 * Update a document
 * @param id - Document ID (used for the API call)
 * @param updates - Document updates
 */
export async function updateDocument(
  id: string,
  updates: Partial<Document>
): Promise<Document> {
  if (!id) {
    throw new Error('Document ID is required for updates');
  }

  // Get current session for authentication
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error('Session error: ' + sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated - please log in to update documents');
  }

  // Check if the token is expired
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < now) {
    throw new Error('Session expired - please log in again');
  }

  // Remove read-only fields
  const { created_at, updated_at, ...safeUpdates } = updates as any;

  // Convert empty strings to null for UUID fields (owner_id)
  // This prevents "invalid input syntax for type uuid" errors
  if ('owner_id' in safeUpdates && safeUpdates.owner_id === '') {
    safeUpdates.owner_id = null;
  }

  // Use document ID for the API call (API route now supports both ID and slug)
  const response = await fetch(`/api/documents/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(safeUpdates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update document');
  }

  const data = await response.json();

  // Clear localStorage cache for documents
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ukidney-documents-cache');
  }

  return data as Document;
}

/**
 * Check if a slug is unique (excluding the current document if editing)
 */
export async function checkSlugUniqueness(slug: string, excludeDocumentId?: string): Promise<boolean> {
  let query = supabase
    .from('documents')
    .select('id')
    .eq('slug', slug);

  // If we're editing an existing document, exclude it from the uniqueness check
  if (excludeDocumentId) {
    query = query.neq('id', excludeDocumentId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(`Failed to check slug uniqueness: ${error.message}`);
  }

  // If we found any results, the slug is not unique
  return !data || data.length === 0;
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }

  // Clear localStorage cache for documents
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ukidney-documents-cache');
  }
}

/**
 * Get all owners for dropdown selection
 * Now uses regular client with proper RLS policies
 */
export async function getOwners(): Promise<Owner[]> {
  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('getOwners: Database error:', error);
    throw new Error(`Failed to fetch owners: ${error.message}`);
  }

  return (data || []) as Owner[];
}

/**
 * Create a new document
 */
export async function createDocument(document: Partial<Document>): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert(document)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  // Clear localStorage cache for documents
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ukidney-documents-cache');
  }

  return data as Document;
}

/**
 * Get all users with their roles (super admin only)
 */
export async function getUsers(): Promise<UserWithRoles[]> {
  // First check if we have a valid session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error('Session error: ' + sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated - please log in to access user management');
  }

  // Check if the token is expired
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < now) {
    throw new Error('Session expired - please log in again');
  }

  const response = await fetch('/api/users', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch users');
  }

  return response.json();
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: string, ownerId?: string): Promise<UserRole> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role, owner_id: ownerId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update user role');
  }

  return response.json();
}

/**
 * Reset user password (sends password reset email)
 */
export async function resetUserPassword(email: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/${encodeURIComponent(email)}/reset-password`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reset password');
  }
}

/**
 * Update user password directly (super admin only)
 */
export async function updateUserPassword(userId: string, password: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/${userId}/password`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update password');
  }
}

/**
 * Delete a user (super admin only)
 */
export async function deleteUser(userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete user');
  }
}

/**
 * Retrain a document with a new PDF
 * Replaces all chunks while preserving document metadata and slug
 */
export async function retrainDocument(
  documentId: string,
  file: File,
  useEdgeFunction: boolean = false
): Promise<{ success: boolean; user_document_id: string; message: string }> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error('Session error: ' + sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated - please log in to retrain documents');
  }

  // Check if the token is expired
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < now) {
    throw new Error('Session expired - please log in again');
  }

  // Create FormData for file upload
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_id', documentId);
  formData.append('use_edge_function', useEdgeFunction.toString());

  const response = await fetch('/api/retrain-document', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start document retraining');
  }

  const data = await response.json();

  // Clear localStorage cache for documents
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ukidney-documents-cache');
  }

  return data;
}

/**
 * Get retraining status for a document
 * Polls the processing status of the associated user_document
 */
export async function getRetrainingStatus(userDocumentId: string): Promise<{
  success: boolean;
  document: {
    id: string;
    title: string;
    status: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
  };
  logs: any[];
}> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error('Session error: ' + sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/processing-status/${userDocumentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get retraining status');
  }

  return response.json();
}

