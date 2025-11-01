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
 */
export async function deleteDocument(id: string) {
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

