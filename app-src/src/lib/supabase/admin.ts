import { supabase } from './client';
import { getUserPermissions } from './permissions';
import type { Document, DocumentWithOwner, Owner } from '@/types/admin';

/**
 * Get all documents based on user permissions
 * Super admins see all documents, owner admins see only their owner group's documents
 */
export async function getDocuments(userId: string): Promise<DocumentWithOwner[]> {
  // Get user permissions to determine access level
  const permissions = await getUserPermissions(userId);
  
  let query = supabase
    .from('documents')
    .select('*, owners(*)')
    .order('created_at', { ascending: false });

  // If not super admin, filter by owner groups
  if (!permissions.is_super_admin) {
    const ownerIds = permissions.owner_groups.map(og => og.owner_id);
    
    if (ownerIds.length === 0) {
      // No access to any owner groups
      return [];
    }
    
    query = query.in('owner_id', ownerIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data || []) as DocumentWithOwner[];
}

/**
 * Update a document
 */
export async function updateDocument(
  id: string,
  updates: Partial<Document>
): Promise<Document> {
  // Remove read-only fields
  const { created_at, updated_at, ...safeUpdates } = updates as any;

  const { data, error } = await supabase
    .from('documents')
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document: ${error.message}`);
  }

  // Clear localStorage cache for documents
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ukidney-documents-cache');
  }

  return data as Document;
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
 */
export async function getOwners(): Promise<Owner[]> {
  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
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

