import type { UserWithRoles } from '@/types/admin';

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function userNeedsApproval(user: UserWithRoles): boolean {
  const hasRoles = user.roles && user.roles.length > 0;
  const hasOwnerGroups = user.owner_groups && user.owner_groups.length > 0;
  return !hasRoles && !hasOwnerGroups;
}

export function isProtectedSuperAdmin(user: UserWithRoles): boolean {
  const hasSuperAdmin = user.roles?.some(r => r.role === 'super_admin') || 
                       (user.owner_groups || []).some(og => og.role === 'super_admin');
  return user.email === 'drjweinstein@gmail.com' && hasSuperAdmin;
}

export function getOwnerName(user: UserWithRoles): string | null {
  const ownerGroups = user.owner_groups || [];
  const roles = user.roles || [];
  const hasSuperAdmin = roles.some(r => r.role === 'super_admin') || 
                       ownerGroups.some(og => og.role === 'super_admin');

  if (hasSuperAdmin) {
    return 'All';
  }

  if (ownerGroups.length > 0) {
    const makerPizza = ownerGroups.find(og => 
      og.owner_name === 'Maker Pizza' || og.owner_slug === 'maker'
    );
    const primaryGroup = makerPizza || ownerGroups[0];
    return primaryGroup.owner_name || null;
  }

  return null;
}

export function getRoleBadge(user: UserWithRoles, isSuperAdmin: boolean) {
  const ownerGroups = user.owner_groups || [];
  const roles = user.roles || [];
  const hasSuperAdmin = roles.some(r => r.role === 'super_admin') || 
                       ownerGroups.some(og => og.role === 'super_admin');

  if (hasSuperAdmin) {
    return {
      label: 'Super Admin',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'Global Access',
    };
  }

  // Check roles first (source of truth), then fall back to owner_groups
  const ownerAdminRole = roles.find(r => r.role === 'owner_admin');
  const registeredRole = roles.find(r => r.role === 'registered');
  
  // Determine role: prioritize roles array, then owner_groups
  let roleLabel: string = 'Registered'; // default
  let ownerName: string | undefined = undefined;
  
  if (ownerAdminRole) {
    roleLabel = 'Owner Admin';
  } else if (registeredRole) {
    roleLabel = 'Registered';
  }
  
  if (ownerGroups.length > 0) {
    const makerPizza = ownerGroups.find(og => 
      og.owner_name === 'Maker Pizza' || og.owner_slug === 'maker'
    );
    const primaryGroup = makerPizza || ownerGroups[0];
    
    // If we couldn't determine role from roles array, use owner_groups
    if (!ownerAdminRole && !registeredRole) {
      roleLabel = primaryGroup.role === 'owner_admin' ? 'Owner Admin' : 'Registered';
    }
    
    ownerName = primaryGroup.owner_name || 'Unknown';
  }
  
  return {
    label: roleLabel,
    color: roleLabel === 'Owner Admin'
      ? 'bg-docutrain-light/20 text-docutrain-dark border-docutrain-light/30'
      : 'bg-gray-100 text-gray-800 border-gray-200',
    description: isSuperAdmin ? ownerName : undefined, // Only show owner name for super admins
  };
}

