import { supabase } from './client';
import type { UserDocument, DocumentStatus } from '@/types/document';

/**
 * Get all documents for the current user
 */
export async function getUserDocuments(userId: string): Promise<UserDocument[]> {
  const { data, error } = await supabase
    .from('user_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a new document record
 */
export async function createDocument(document: {
  user_id: string;
  title: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
}) {
  const { data, error } = await supabase
    .from('user_documents')
    .insert(document)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return data;
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  errorMessage?: string
) {
  const updates: { status: DocumentStatus; error_message?: string } = { status };
  
  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  const { data, error } = await supabase
    .from('user_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document status: ${error.message}`);
  }

  return data;
}

/**
 * Delete a document record
 * Marks document as cancelled before deletion to stop processing
 */
export async function deleteDocument(id: string) {
  // First, mark as cancelled to stop any ongoing processing
  try {
    const { data: existingDoc } = await supabase
      .from('user_documents')
      .select('metadata')
      .eq('id', id)
      .single();
    
    const updatedMetadata = {
      ...(existingDoc?.metadata || {}),
      cancelled: true,
      cancelled_at: new Date().toISOString()
    };
    
    // Update metadata to mark as cancelled (this will stop processing)
    await supabase
      .from('user_documents')
      .update({ metadata: updatedMetadata })
      .eq('id', id);
    
    // Small delay to allow cancellation check to run
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (markError) {
    // If marking as cancelled fails, still proceed with deletion
    console.warn('Failed to mark document as cancelled before deletion:', markError);
  }
  
  // Now delete the document
  const { error } = await supabase
    .from('user_documents')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Subscribe to real-time changes for user documents
 */
export function subscribeToDocuments(
  userId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel('user_documents_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_documents',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Check if user has accepted Terms of Service
 */
export async function hasAcceptedTermsOfService(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('tos_accepted_at')
    .eq('user_id', userId)
    .single();

  if (error) {
    // If no profile exists, user hasn't accepted TOS
    if (error.code === 'PGRST116') {
      return false;
    }
    // Log other errors but assume TOS not accepted to be safe
    console.error('Error checking TOS acceptance:', error);
    return false;
  }

  return !!data?.tos_accepted_at;
}

/**
 * Get user profile with TOS information
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No profile exists yet
    }
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }

  return data;
}

/**
 * Record Terms of Service acceptance
 */
export async function acceptTermsOfService(userId: string, version: string = '2025-10-31') {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      tos_accepted_at: new Date().toISOString(),
      tos_version: version,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record TOS acceptance: ${error.message}`);
  }

  return data;
}

/**
 * Update user profile with name and TOS acceptance
 */
export async function updateUserProfile(
  userId: string,
  data: {
    first_name?: string;
    last_name?: string;
    tos_accepted_at?: string;
    tos_version?: string;
  }
) {
  const updateData: {
    first_name?: string;
    last_name?: string;
    tos_accepted_at?: string;
    tos_version?: string;
    updated_at: string;
  } = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      ...updateData,
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }

  return profile;
}

/**
 * Get current user's profile (self-service via API)
 */
export async function getMyProfile(): Promise<{
  first_name: string | null;
  last_name: string | null;
  email: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/users/me/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let errorMessage = `Failed to fetch profile (${response.status})`;
    // Clone response before reading so we can read it multiple times if needed
    const responseClone = response.clone();
    try {
      const errorData = await response.json();
      errorMessage = errorData.details || errorData.error || errorMessage;
    } catch (e) {
      // If JSON parsing fails, try to get text from clone
      try {
        const text = await responseClone.text();
        errorMessage = text || errorMessage;
      } catch (textError) {
        // If that also fails, use the status-based message
        console.error('Failed to parse error response:', textError);
      }
    }
    console.error('Profile fetch error:', {
      status: response.status,
      statusText: response.statusText,
      message: errorMessage
    });
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Update current user's profile (self-service via API)
 * Supports email, first_name, and last_name
 */
export async function updateMyProfile(data: {
  email?: string;
  first_name?: string;
  last_name?: string;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/users/me/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorData.details || errorData.error || 'Failed to update profile';
    throw new Error(errorMessage);
  }

  // If email was updated, refresh the auth user
  if (data.email) {
    await supabase.auth.refreshSession();
  }
}

