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
      className: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    owner_admin: {
      label: 'Admin',
      className: 'bg-gradient-to-r from-docutrain-light/20 to-docutrain-light/30 text-docutrain-dark border border-docutrain-light/40 shadow-sm shadow-docutrain-light/20',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    super_admin: {
      label: 'Super Admin',
      className: 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-400 shadow-md shadow-red-500/30',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  };

  const config = roleConfig[role];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${config.className} transition-all duration-200`}>
      {config.icon}
      <span>{config.label}</span>
      {ownerName && role !== 'super_admin' && (
        <span className="ml-0.5">• {ownerName}</span>
      )}
    </span>
  );
}

