import React from 'react';
import type { DocumentStatus as Status } from '@/types/document';

interface DocumentStatusProps {
  status: Status;
}

export function DocumentStatus({ status }: DocumentStatusProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-gray-100 text-gray-800',
    },
    processing: {
      label: 'Processing',
      className: 'bg-blue-100 text-blue-800',
    },
    ready: {
      label: 'Ready',
      className: 'bg-green-100 text-green-800',
    },
    error: {
      label: 'Error',
      className: 'bg-red-100 text-red-800',
    },
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

