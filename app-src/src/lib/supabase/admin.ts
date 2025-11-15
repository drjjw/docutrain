import { supabase } from './client';
import { getUserPermissions } from './permissions';
import type { Document, DocumentWithOwner, Owner, UserWithRoles, UserRole, DocumentAttachment, PendingInvitation, Category } from '@/types/admin';
import { debugLog } from '@/utils/debug';

/**
 * Get a valid session, refreshing if necessary
 * This ensures we always have a non-expired token before making API calls
 * Exported so other components can use it
 */
export async function getValidSession(): Promise<{ access_token: string }> {
  // Get current session
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('❌ getSession error:', sessionError);
    throw new Error('Session error: ' + sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated - please log in');
  }

  // Check if token is expired or about to expire (within 60 seconds)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || 0;
  const timeUntilExpiry = expiresAt - now;

  // If expired or expiring soon, try to refresh
  // Note: timeUntilExpiry can be negative if already expired
  if (!expiresAt || timeUntilExpiry < 60) {
    debugLog(`🔄 Session ${timeUntilExpiry < 0 ? 'expired' : 'expiring soon'} (${timeUntilExpiry}s), refreshing...`);
    debugLog('🔄 Current session has refresh_token:', !!session.refresh_token);
    
    try {
      // Pass the current session to refreshSession to ensure it uses the refresh_token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(session);

      if (refreshError) {
        console.error('❌ Failed to refresh session:', refreshError);
        console.error('❌ Refresh error details:', {
          message: refreshError.message,
          status: refreshError.status,
          name: refreshError.name
        });
        
        // Check if it's a refresh token expiration
        if (refreshError.message?.includes('refresh_token') || 
            refreshError.message?.includes('expired') ||
            refreshError.message?.includes('invalid_grant') ||
            refreshError.message?.includes('invalid refresh token')) {
          throw new Error('Session expired - please log in again');
        }
        throw new Error('Session refresh failed - please log in again');
      }

      if (refreshData.session?.access_token) {
        session = refreshData.session;
        debugLog('✅ Session refreshed successfully');
        debugLog('✅ New token expires at:', new Date((refreshData.session.expires_at || 0) * 1000).toISOString());
      } else {
        console.error('❌ Refresh succeeded but no session returned');
        throw new Error('Session expired - please log in again');
      }
    } catch (refreshErr) {
      console.error('❌ Refresh exception:', refreshErr);
      // If refresh fails, check if we can still use the current token
      // (might be a network error, not an expiration)
      if (timeUntilExpiry > 0) {
        console.warn('⚠️ Refresh failed but token still valid, using current token');
        return { access_token: session.access_token };
      }
      // Token is expired and refresh failed - user must log in
      throw refreshErr instanceof Error ? refreshErr : new Error('Session expired - please log in again');
    }
  }

  return { access_token: session.access_token };
}

/**
 * Get all documents based on user permissions
 * Super admins see all documents, owner admins see only their owner group's documents
 */
/**
 * Check if references should be disabled for a document
 * References are disabled when:
 * 1. Multiple PDFs were used (more than one PDF upload)
 * 2. Retraining occurred where content was ADDED (retrain_add mode)
 * 
 * @param documentId - Document ID (UUID)
 * @returns Object with disabled flag and reason message
 */
export async function checkReferencesDisabled(documentId: string): Promise<{
  disabled: boolean;
  reason: string | null;
}> {
  try {
    const { data: history, error } = await supabase
      .from('document_training_history')
      .select('action_type, upload_type, retrain_mode, status')
      .eq('document_id', documentId)
      .eq('status', 'completed');

    if (error) {
      debugLog('Error checking training history:', error);
      // If we can't check, default to allowing references (safer)
      return { disabled: false, reason: null };
    }

    if (!history || history.length === 0) {
      // No training history - assume single PDF, allow references
      return { disabled: false, reason: null };
    }

    // Check for retrain_add actions
    const hasRetrainAdd = history.some(
      entry => entry.action_type === 'retrain_add' || entry.retrain_mode === 'add'
    );

    if (hasRetrainAdd) {
      return {
        disabled: true,
        reason: 'References are disabled because content was added through retraining. Page numbers are no longer meaningful when content is added incrementally.'
      };
    }

    // Count distinct PDF uploads (train or retrain_replace with PDF)
    const pdfUploads = history.filter(
      entry => 
        entry.upload_type === 'pdf' && 
        (entry.action_type === 'train' || entry.action_type === 'retrain_replace')
    );

    // Count unique PDF uploads by checking distinct file_name or user_document_id
    // For simplicity, we'll count completed PDF uploads
    // If there's more than one PDF upload, disable references
    if (pdfUploads.length > 1) {
      return {
        disabled: true,
        reason: 'References are disabled because multiple PDFs were used. Page numbers are only meaningful when a single PDF is used.'
      };
    }

    return { disabled: false, reason: null };
  } catch (error) {
    debugLog('Exception checking references disabled:', error);
    return { disabled: false, reason: null };
  }
}

export async function getDocuments(userId: string): Promise<DocumentWithOwner[]> {
  // Get user permissions to determine access level
  const permissions = await getUserPermissions(userId);
  
  // Query with join to document_chunks to filter out documents without chunks
  // Only show documents that have at least one chunk (prevents showing documents during processing)
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
      category_id,
      categories!documents_category_id_fkey(id, name, is_custom, owner_id),
      owner,
      owner_id,
      cover,
      intro_message,
      downloads,
      chunk_limit_override,
      show_document_selector,
      show_keywords,
      show_downloads,
      show_references,
      show_recent_questions,
      show_country_flags,
      show_quizzes,
      quizzes_generated,
      show_disclaimer,
      disclaimer_text,
      access_level,
      passcode,
      uploaded_by_user_id,
      owners(*),
      document_chunks!inner(document_slug)
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

    // Transform owners array to single owner object for type compatibility
    // Remove document_chunks from response (it was only used for filtering)
    return filtered.map(doc => {
      const { document_chunks, categories, ...docWithoutChunks } = doc;
      const categoryObj = Array.isArray(categories) ? categories[0] : categories;
      return {
        ...docWithoutChunks,
        category_obj: categoryObj || undefined,
        owners: Array.isArray(doc.owners) ? doc.owners[0] : doc.owners
      };
    }) as DocumentWithOwner[];
  }

  // Super admin sees all documents
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  // Transform owners array to single owner object for type compatibility
  // Remove document_chunks from response (it was only used for filtering)
  return (data || []).map(doc => {
    const { document_chunks, categories, ...docWithoutChunks } = doc;
    const categoryObj = Array.isArray(categories) ? categories[0] : categories;
    return {
      ...docWithoutChunks,
      category_obj: categoryObj || undefined,
      owners: Array.isArray(doc.owners) ? doc.owners[0] : doc.owners
    };
  }) as DocumentWithOwner[];
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

  // Get valid session (will refresh if needed)
  let { access_token } = await getValidSession();

  // Remove read-only fields
  const { created_at, updated_at, ...safeUpdates } = updates as any;

  // Convert empty strings to null for UUID fields (owner_id)
  // This prevents "invalid input syntax for type uuid" errors
  if ('owner_id' in safeUpdates && safeUpdates.owner_id === '') {
    safeUpdates.owner_id = null;
  }

  // Make API call with retry logic for 401 errors
  const makeRequest = async (token: string) => {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safeUpdates),
    });

    return response;
  };

  let response = await makeRequest(access_token);

  // If we get a 401, try refreshing the session once and retry
  if (response.status === 401) {
    debugLog('🔄 Got 401, refreshing session and retrying...');
    try {
      const refreshed = await getValidSession();
      access_token = refreshed.access_token;
      response = await makeRequest(access_token);
    } catch (refreshError) {
      throw new Error('Authentication failed - please log in again');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update document' }));
    throw new Error(error.error || 'Failed to update document');
  }

  const data = await response.json();

  // Clear all document cache keys (new and legacy)
  if (typeof window !== 'undefined') {
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

  // Clear all document cache keys (new and legacy)
  if (typeof window !== 'undefined') {
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
 * Get all owners (super admin only - uses API route)
 */
export async function getAllOwners(): Promise<Owner[]> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/owners', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch owners');
  }

  return response.json();
}

/**
 * Create a new owner (super admin only)
 */
export async function createOwner(owner: Partial<Owner>): Promise<Owner> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/owners', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(owner),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to create owner');
  }

  return response.json();
}

/**
 * Update an owner (super admin only)
 */
export async function updateOwner(id: string, updates: Partial<Owner>): Promise<Owner> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/owners/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to update owner');
  }

  return response.json();
}

/**
 * Get a single owner by ID (super admin or owner admin for their own owner)
 */
export async function getOwner(id: string): Promise<Owner> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/owners/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to fetch owner');
  }

  return response.json();
}

/**
 * Update owner settings (for owner admins - limited fields only)
 * This function filters updates to only allowed fields: logo_url, intro_message, default_cover, metadata.accent_color
 */
export async function updateOwnerSettings(id: string, updates: Partial<Owner>): Promise<Owner> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Filter updates to only allowed fields for owner admins
  // Note: Super admins can update more fields via direct API calls
  const allowedFields: Partial<Owner> = {};
  if (updates.logo_url !== undefined) allowedFields.logo_url = updates.logo_url;
  if (updates.intro_message !== undefined) allowedFields.intro_message = updates.intro_message;
  if (updates.default_cover !== undefined) allowedFields.default_cover = updates.default_cover;
  
  // Handle metadata (accent_color for owner admins, full metadata for super admins)
  if (updates.metadata !== undefined) {
    allowedFields.metadata = updates.metadata as any;
  }

  const response = await fetch(`/api/owners/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(allowedFields),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to update owner settings');
  }

  return response.json();
}

/**
 * Delete an owner (super admin only)
 */
export async function deleteOwner(id: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/owners/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to delete owner');
  }
}

/**
 * Get all categories available for an owner
 * Returns system defaults + owner-specific categories
 */
export async function getCategoriesForOwner(ownerId?: string | null): Promise<Category[]> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Use the database function if available, otherwise query directly
  const { data, error } = await supabase.rpc('get_categories_for_owner', {
    p_owner_id: ownerId || null
  });

  if (error) {
    // Fallback to direct query if function doesn't exist
    const query = supabase
      .from('categories')
      .select('*')
      .or(`owner_id.is.null,owner_id.eq.${ownerId || ''}`)
      .order('owner_id', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });

    const { data: fallbackData, error: fallbackError } = await query;

    if (fallbackError) {
      throw new Error(`Failed to fetch categories: ${fallbackError.message}`);
    }

    return fallbackData || [];
  }

  return data || [];
}

/**
 * Create a new category
 */
export async function createCategory(category: {
  name: string;
  is_custom?: boolean;
  owner_id?: string | null;
}): Promise<Category> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      ...category,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }

  return data;
}

/**
 * Update a category
 */
export async function updateCategory(id: number, updates: Partial<Category>): Promise<Category> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('categories')
    .update({
      ...updates,
      updated_by: session.user.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }

  return data;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
}

/**
 * Find or create a category by name
 * Returns the category ID
 */
export async function findOrCreateCategory(name: string, ownerId?: string | null): Promise<number> {
  if (!name.trim()) {
    throw new Error('Category name cannot be empty');
  }

  // First, try to find existing category
  // Use proper null handling for owner_id
  let query = supabase
    .from('categories')
    .select('id')
    .eq('name', name.trim());
  
  if (ownerId) {
    query = query.eq('owner_id', ownerId);
  } else {
    query = query.is('owner_id', null);
  }
  
  const { data: existing, error: findError } = await query.maybeSingle();

  // If category exists, return its ID
  if (existing && !findError) {
    return existing.id;
  }

  // If error is not "not found", throw it
  if (findError && findError.code !== 'PGRST116') {
    throw new Error(`Failed to find category: ${findError.message}`);
  }

  // Category doesn't exist, create it
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const { data: newCategory, error: createError } = await supabase
    .from('categories')
    .insert({
      name: name.trim(),
      is_custom: true,
      owner_id: ownerId || null,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select('id')
    .single();

  if (createError) {
    throw new Error(`Failed to create category: ${createError.message}`);
  }

  return newCategory.id;
}

export interface SystemConfig {
  key: string;
  value: any;
  description?: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

/**
 * Get a system configuration value by key
 * @param key - Configuration key (e.g., 'default_categories')
 * @returns SystemConfig object or null if not found
 */
export async function getSystemConfig(key: string): Promise<SystemConfig | null> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/system-config/${key}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to fetch system config');
  }

  return response.json();
}

/**
 * Get all system configurations (super admin only)
 * @returns Array of SystemConfig objects
 */
export async function getAllSystemConfigs(): Promise<SystemConfig[]> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/system-config', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to fetch system configs');
  }

  return response.json();
}

/**
 * Update a system configuration value (super admin only)
 * @param key - Configuration key (e.g., 'default_categories')
 * @param value - New value (will be stored as JSONB)
 * @returns Updated SystemConfig object
 */
export async function updateSystemConfig(key: string, value: any): Promise<SystemConfig> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/system-config/${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.details || 'Failed to update system config');
  }

  return response.json();
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

  // Clear all document cache keys (new and legacy)
  if (typeof window !== 'undefined') {
  }

  return data as Document;
}

/**
 * Get all users with their roles (super admin only)
 */
export async function getUsers(): Promise<UserWithRoles[]> {
  // Get valid session (will refresh if needed)
  const { access_token } = await getValidSession();

  const response = await fetch('/api/users', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  });

  // If we get a 401, try refreshing the session once and retry
  if (response.status === 401) {
    debugLog('🔄 Got 401, refreshing session and retrying...');
    try {
      const refreshed = await getValidSession();
      const retryResponse = await fetch('/api/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${refreshed.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({ error: 'Failed to fetch users' }));
        throw new Error(error.error || 'Failed to fetch users');
      }
      return retryResponse.json();
    } catch (refreshError) {
      throw new Error('Authentication failed - please log in again');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
    throw new Error(error.error || 'Failed to fetch users');
  }

  return response.json();
}

/**
 * Get pending invitations (invitations that haven't been used yet and haven't expired)
 */
export async function getPendingInvitations(): Promise<PendingInvitation[]> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/users/pending-invitations', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch pending invitations');
  }

  return response.json();
}

/**
 * Delete a pending invitation
 */
export async function deletePendingInvitation(invitationId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/pending-invitations/${invitationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete invitation');
  }
}

/**
 * Resend a pending invitation
 * Deletes the old invitation and creates a new one via the edge function
 */
export async function resendPendingInvitation(invitationId: string): Promise<{ success: boolean; message: string; invitation_id: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/pending-invitations/${invitationId}/resend`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to resend invitation');
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
    body: JSON.stringify({ role, owner_id: ownerId || null }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorData.details || errorData.error || 'Failed to update user role';
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Invite a user to join an owner group
 */
export async function inviteUser(email: string, ownerId: string | null, role: string = 'registered'): Promise<{ success: boolean; message: string; action: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/users/invite', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, owner_id: ownerId, role }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to invite user');
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
 * Delete a user (super admin and owner admin)
 */
export async function deleteUser(userId: string, action: 'delete' | 'ban' | 'unban' = 'delete', banDuration?: 'permanent' | 'temporary', banHours?: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams({ action });
  if (action === 'ban') {
    if (banDuration) params.append('ban_duration', banDuration);
    if (banHours) params.append('ban_hours', banHours.toString());
  }

  const response = await fetch(`/api/users/${userId}?${params.toString()}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process user action');
  }
}

/**
 * Ban a user (super admin and owner admin)
 */
export async function banUser(userId: string, duration: 'permanent' | 'temporary' = 'permanent', hours?: number): Promise<void> {
  return deleteUser(userId, 'ban', duration, hours);
}

/**
 * Unban a user (super admin and owner admin)
 */
export async function unbanUser(userId: string): Promise<void> {
  return deleteUser(userId, 'unban');
}

/**
 * Get user statistics (super admin and owner admin)
 */
export async function getUserStatistics(userId: string): Promise<import('@/types/admin').UserStatistics> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/${userId}/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch user statistics');
  }

  return response.json();
}

/**
 * Get user profile data (admin function)
 */
export async function getUserProfileAsAdmin(userId: string): Promise<{
  first_name?: string;
  last_name?: string;
} | null> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/${userId}/profile`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorData.details || errorData.error || 'Failed to fetch user profile';
    throw new Error(errorMessage);
  }

  const data = await response.json();
  // Return null if both fields are null (no profile), otherwise return the data
  if (data.first_name === null && data.last_name === null) {
    return null;
  }
  return data;
}

/**
 * Update user profile (email, first_name, last_name) - Admin function
 */
export async function updateUserProfileAsAdmin(
  userId: string,
  data: {
    email?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/users/${userId}/profile`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorData.details || errorData.error || 'Failed to update user profile';
    throw new Error(errorMessage);
  }
}

/**
 * Retrain a document with a new PDF
 * Replaces all chunks while preserving document metadata and slug
 * 
 * @param retrainMode - 'replace' (default) to replace all chunks, 'add' to add chunks incrementally
 */
export async function retrainDocument(
  documentId: string,
  file: File,
  useEdgeFunction: boolean = false,
  retrainMode: 'replace' | 'add' = 'replace'
): Promise<{ success: boolean; user_document_id: string; message: string }> {
  // Get valid session (will refresh if needed)
  let { access_token } = await getValidSession();

  // Create FormData for file upload
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_id', documentId);
  formData.append('use_edge_function', useEdgeFunction.toString());
  formData.append('retrain_mode', retrainMode);

  debugLog('📤 Starting retrain for document:', documentId, 'file:', file.name, 'size:', file.size);

  // Make API call with retry logic for 401 errors
  const makeRequest = async (token: string) => {
    return await fetch('/api/retrain-document', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
  };

  let response = await makeRequest(access_token);

  // If we get a 401, try refreshing the session once and retry
  if (response.status === 401) {
    debugLog('🔄 Got 401, refreshing session and retrying...');
    try {
      const refreshed = await getValidSession();
      access_token = refreshed.access_token;
      response = await makeRequest(access_token);
    } catch (refreshError) {
      throw new Error('Authentication failed - please log in again');
    }
  }

  if (!response.ok) {
    let errorMessage = 'Failed to start document retraining';
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
      if (error.details) {
        errorMessage += `: ${error.details}`;
      }
      console.error('❌ Retrain document error:', error);
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = `Server error (${response.status}): ${response.statusText}`;
      console.error('❌ Retrain document error - non-JSON response:', response.status, response.statusText);
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Clear all document cache keys (new and legacy)
  if (typeof window !== 'undefined') {
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

/**
 * Get all attachments for a document
 */
export async function getDocumentAttachments(documentId: string): Promise<DocumentAttachment[]> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/attachments/${documentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch attachments';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.attachments || [];
}

/**
 * Create a new attachment for a document
 */
export async function createDocumentAttachment(
  documentId: string,
  attachment: {
    title: string;
    url: string;
    storage_path?: string;
    file_size?: number;
    mime_type?: string;
    display_order?: number;
    copyright_acknowledged_at?: string;
  }
): Promise<DocumentAttachment> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/attachments/${documentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(attachment),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to create attachment';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.attachment;
}

/**
 * Update an attachment
 */
export async function updateDocumentAttachment(
  attachmentId: string,
  updates: Partial<{
    title: string;
    url: string;
    storage_path: string;
    file_size: number;
    mime_type: string;
    display_order: number;
  }>
): Promise<DocumentAttachment> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/attachments/${attachmentId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update attachment');
  }

  const data = await response.json();
  return data.attachment;
}

/**
 * Delete an attachment
 */
export async function deleteDocumentAttachment(attachmentId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete attachment');
  }
}

/**
 * Track a download event for an attachment
 */
export async function trackAttachmentDownload(attachmentId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  // This endpoint allows anonymous downloads, so we don't require auth
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`/api/attachments/${attachmentId}/track-download`, {
    method: 'POST',
    headers,
  });

  // Don't throw on error - tracking failures shouldn't break downloads
  if (!response.ok) {
    console.warn('Failed to track download event');
  }
}

/**
 * Get document analytics including conversations and downloads
 */
export async function getDocumentAnalytics(
  documentId: string,
  conversationOffset: number = 0,
  downloadOffset: number = 0,
  conversationLimit: number = 100,
  downloadLimit: number = 100
): Promise<import('@/types/admin').DocumentAnalytics> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams({
    limit: conversationLimit.toString(),
    offset: conversationOffset.toString(),
    downloadLimit: downloadLimit.toString(),
    downloadOffset: downloadOffset.toString(),
  });

  const response = await fetch(`/api/documents/${documentId}/analytics?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch document analytics');
  }

  const data = await response.json();
  return data;
}

/**
 * Get quota information for an owner
 */
export interface OwnerQuota {
  plan_tier: string;
  document_limit: number | null;
  document_count: number;
  can_upload: boolean;
  can_use_voice_training: boolean;
  usage_percentage: number | null;
  is_unlimited: boolean;
}

export async function getOwnerQuota(ownerId: string): Promise<OwnerQuota> {
  const { access_token } = await getValidSession();

  const response = await fetch(`/api/owners/${ownerId}/quota`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch quota information');
  }

  const data = await response.json();
  return data;
}


