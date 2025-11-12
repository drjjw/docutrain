import { supabase } from './client';
import type { UserPermissions } from '@/types/permissions';
import { debugLog } from '@/utils/debug';
import { getAuthHeaders } from '@/lib/api/authService';

/**
 * Get current user's permissions via API endpoint
 * Uses API endpoint instead of direct Supabase query for better performance (bypasses RLS)
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  try {
    const response = await fetch('/api/permissions', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch permissions: HTTP ${response.status}`);
    }

    const data = await response.json();
    
    debugLog('getUserPermissions - data from API:', data);

    return {
      permissions: data.permissions || [],
      is_super_admin: data.is_super_admin || false,
      owner_groups: data.owner_groups || [],
    };
  } catch (error) {
    debugLog('getUserPermissions - error:', error);
    throw error;
  }
}

/**
 * Get accessible owner groups for user (with details including logo_url)
 */
export async function getAccessibleOwners(userId: string) {
  const { data, error } = await supabase
    .rpc('get_user_owner_access_with_details', { p_user_id: userId });

  if (error) {
    throw new Error(`Failed to fetch accessible owners: ${error.message}`);
  }

  return data || [];
}

/**
 * Check if user can access a document by slug
 */
export async function checkDocumentAccess(userId: string | null, documentSlug: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('user_has_document_access_by_slug', {
      p_user_id: userId,
      p_document_slug: documentSlug,
    });

  if (error) {
    console.error('Document access check error:', error);
    return false;
  }

  return data || false;
}

/**
 * Grant owner access to a user (admin only)
 */
export async function grantOwnerAccess(targetUserId: string, ownerId: string) {
  const { data, error } = await supabase
    .from('user_owner_access')
    .insert({
      user_id: targetUserId,
      owner_id: ownerId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to grant access: ${error.message}`);
  }

  return data;
}

/**
 * Revoke owner access from a user (admin only)
 */
export async function revokeOwnerAccess(accessId: string) {
  const { error } = await supabase
    .from('user_owner_access')
    .delete()
    .eq('id', accessId);

  if (error) {
    throw new Error(`Failed to revoke access: ${error.message}`);
  }
}

/**
 * Check if user needs approval (has no roles or owner access)
 */
export async function checkUserNeedsApproval(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('user_needs_approval', { p_user_id: userId });

  if (error) {
    console.error('Failed to check approval status:', error);
    // If check fails, assume user needs approval to be safe
    return true;
  }

  return data || false;
}

