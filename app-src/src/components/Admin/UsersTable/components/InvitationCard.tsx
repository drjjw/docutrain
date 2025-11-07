import { Button } from '@/components/UI/Button';
import type { PendingInvitation } from '@/types/admin';
import { formatDate } from '../utils';

interface InvitationCardProps {
  invitation: PendingInvitation;
  saving: boolean;
  resendingInvitationId: string | null;
  deletingInvitationId: string | null;
  onResend: (invitationId: string) => void;
  onDelete: (invitationId: string) => void;
}

export function InvitationCard({
  invitation,
  saving,
  resendingInvitationId,
  deletingInvitationId,
  onResend,
  onDelete,
}: InvitationCardProps) {
  const expiresAt = new Date(invitation.expires_at);
  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = daysUntilExpiry <= 7;
  
  return (
    <div 
      className="bg-docutrain-light/10 rounded-lg shadow-sm border border-docutrain-light/30 border-l-4 border-l-docutrain-light overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-4 py-4 bg-gradient-to-r from-docutrain-light/10 to-white border-b border-docutrain-light/20">
        <div className="flex items-center gap-3">
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
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResend(invitation.id)}
              disabled={saving || resendingInvitationId === invitation.id}
              loading={resendingInvitationId === invitation.id}
              className="flex-1 min-w-[120px]"
              title="Resend invitation email"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Resend
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete(invitation.id)}
              disabled={saving || deletingInvitationId === invitation.id}
              className="flex-1 min-w-[120px]"
              title="Delete invitation"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

