import React from 'react';
import type { UserRole } from '@/types/permissions';

interface PermissionsBadgeProps {
  role: UserRole;
  ownerName?: string;
  ownerLogoUrl?: string;
}

export function PermissionsBadge({ role, ownerName }: PermissionsBadgeProps) {
  const roleConfig = {
    registered: {
      label: 'User',
      className: 'bg-docutrain-light/10 text-docutrain-dark',
    },
    owner_admin: {
      label: 'Admin',
      className: 'bg-docutrain-light/20 text-docutrain-dark',
    },
    super_admin: {
      label: 'Super Admin',
      className: 'bg-red-100 text-red-800',
    },
  };

  const config = roleConfig[role];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
      {ownerName && role !== 'super_admin' && (
        <span className="ml-1">• {ownerName}</span>
      )}
    </span>
  );
}

