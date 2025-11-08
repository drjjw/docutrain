import type { PendingInvitation } from '@/types/admin';
import { formatDate } from '../utils';
import { InvitationActionsModal } from '../modals/InvitationActionsModal';
import { useState } from 'react';

interface InvitationCardProps {
  invitation: PendingInvitation;
  selectedInvitationIds: Set<string>;
  saving: boolean;
  resendingInvitationId: string | null;
  deletingInvitationId: string | null;
  onToggleSelection: (invitationId: string) => void;
  onResend: (invitationId: string) => void;
  onDelete: (invitationId: string) => void;
}

export function InvitationCard({
  invitation,
  selectedInvitationIds,
  saving,
  resendingInvitationId,
  deletingInvitationId,
  onToggleSelection,
  onResend,
  onDelete,
}: InvitationCardProps) {
  const expiresAt = new Date(invitation.expires_at);
  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = daysUntilExpiry <= 7;
  const isSelected = selectedInvitationIds.has(invitation.id);
  const [showActionsModal, setShowActionsModal] = useState(false);
  
  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${isSelected ? 'bg-docutrain-light/10' : ''}`}
    >
      {/* Card Header */}
      <div className={`px-4 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 ${isSelected ? 'bg-docutrain-light/10' : ''}`}>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(invitation.id)}
            className="w-4 h-4 text-docutrain-light border-gray-300 rounded focus:ring-docutrain-light flex-shrink-0"
          />
          <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-medium">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{invitation.email}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-docutrain-light/20 text-docutrain-dark border border-docutrain-light/30">
                Pending Invitation
              </span>
              {isExpiringSoon && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-4 py-4 space-y-4">
        {/* Role Section */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Will Join Owner Group
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border bg-gray-100 text-gray-800 border-gray-200">
                {invitation.owner_name}
              </div>
              {invitation.invited_by_email && (
                <div className="text-xs text-gray-500 mt-1">
                  Invited by: {invitation.invited_by_email}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dates Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
          <div>
            <div className="text-xs text-gray-500 mb-1">Created</div>
            <div className="text-sm font-medium text-gray-900">
              {formatDate(invitation.created_at)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Expires</div>
            <div className="text-sm font-medium text-gray-900">
              {formatDate(invitation.expires_at)}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-docutrain-light" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-docutrain-light font-medium">Awaiting Signup</span>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowActionsModal(true)}
              disabled={saving}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Actions"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <InvitationActionsModal
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        invitationEmail={invitation.email}
        saving={saving}
        isResending={resendingInvitationId === invitation.id}
        isDeleting={deletingInvitationId === invitation.id}
        onResend={() => onResend(invitation.id)}
        onDelete={() => onDelete(invitation.id)}
      />
    </div>
  );
}

