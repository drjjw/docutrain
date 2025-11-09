import { supabase } from './client';
import type { UserPermissions } from '@/types/permissions';
import { debugLog } from '@/utils/debug';

/**
 * Get current user's permissions
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const { data, error } = await supabase
    .from('user_permissions_summary')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to fetch permissions: ${error.message}`);
  }

  debugLog('getUserPermissions - raw data from DB:', data);

  const isSuperAdmin = data?.some(p => p.role === 'super_admin') || false;

  return {
    permissions: data || [],
    is_super_admin: isSuperAdmin,
    owner_groups: (data || []).map(p => ({
      owner_id: p.owner_id,
      owner_slug: p.owner_slug,
      owner_name: p.owner_name,
      owner_logo_url: p.owner_logo_url,
      role: p.role,
    })),
  };
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

