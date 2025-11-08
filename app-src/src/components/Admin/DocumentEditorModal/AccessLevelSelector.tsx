import React from 'react';
import type { AccessLevelSelectorProps } from './types';

export function AccessLevelSelector({
  accessLevel,
  onAccessLevelChange,
  ownerId,
  owners,
  passcode,
  onPasscodeChange
}: AccessLevelSelectorProps) {
  return (
    <div className="mb-6">
      <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Access Level
      </h5>
      
      {/* Compact Grid Layout */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Public */}
        <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
          accessLevel === 'public' 
            ? 'border-blue-500 bg-blue-50 shadow-sm' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}>
          <input
            type="radio"
            name="access_level"
            value="public"
            checked={accessLevel === 'public'}
            onChange={(e) => onAccessLevelChange(e.target.value)}
            className="sr-only"
          />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M11 3.055V5a2 2 0 002 2h1M13 13v2.945M20.945 13H19a2 2 0 00-2-2v-1a2 2 0 00-2-2 2 2 0 00-2-2H9.055M11 20.945V19a2 2 0 002-2v-1a2 2 0 002 2h2.945M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-gray-900">Public</span>
          </div>
          <span className="text-xs text-gray-600">No login required</span>
        </label>

        {/* Owner Admins Only */}
        <label className={`relative flex flex-col p-4 border-2 rounded-lg transition-all ${
          !ownerId 
            ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' 
            : accessLevel === 'owner_admin_only'
              ? 'border-red-500 bg-red-50 shadow-sm cursor-pointer'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
        }`}>
          <input
            type="radio"
            name="access_level"
            value="owner_admin_only"
            checked={accessLevel === 'owner_admin_only'}
            onChange={(e) => onAccessLevelChange(e.target.value)}
            disabled={!ownerId}
            className="sr-only"
          />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="font-medium text-gray-900">Owner Admins Only</span>
          </div>
          <span className="text-xs text-gray-600">Administrators of {ownerId ? (owners.find(o => o.id === ownerId)?.name || 'owner group') : 'owner group'} only</span>
        </label>

        {/* Registered */}
        <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
          accessLevel === 'registered' 
            ? 'border-green-500 bg-green-50 shadow-sm' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}>
          <input
            type="radio"
            name="access_level"
            value="registered"
            checked={accessLevel === 'registered'}
            onChange={(e) => onAccessLevelChange(e.target.value)}
            className="sr-only"
          />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-medium text-gray-900">Registered</span>
          </div>
          <span className="text-xs text-gray-600">Any logged-in user</span>
        </label>

        {/* Owner Restricted */}
        <label className={`relative flex flex-col p-4 border-2 rounded-lg transition-all ${
          !ownerId 
            ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' 
            : accessLevel === 'owner_restricted'
              ? 'border-yellow-500 bg-yellow-50 shadow-sm cursor-pointer'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
        }`}>
          <input
            type="radio"
            name="access_level"
            value="owner_restricted"
            checked={accessLevel === 'owner_restricted'}
            onChange={(e) => onAccessLevelChange(e.target.value)}
            disabled={!ownerId}
            className="sr-only"
          />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="font-medium text-gray-900">Owner Group</span>
          </div>
          <span className="text-xs text-gray-600">Group members only</span>
        </label>

        {/* Passcode */}
        <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
          accessLevel === 'passcode'
            ? 'border-docutrain-medium bg-docutrain-light/10 shadow-sm' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}>
          <input
            type="radio"
            name="access_level"
            value="passcode"
            checked={accessLevel === 'passcode'}
            onChange={(e) => onAccessLevelChange(e.target.value)}
            className="sr-only"
          />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-docutrain-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="font-medium text-gray-900">Passcode</span>
          </div>
          <span className="text-xs text-gray-600 mb-2">URL with passcode</span>
          
          {/* Passcode Input Field - shown when passcode is selected */}
          {accessLevel === 'passcode' && (
            <div className="mt-2 pt-2 border-t border-docutrain-light/30">
              <input
                type="text"
                value={passcode || ''}
                onChange={(e) => onPasscodeChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Enter passcode..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-docutrain-medium focus:border-docutrain-medium"
              />
            </div>
          )}
        </label>
      </div>

      {/* Warning for owner-restricted options */}
      {!ownerId && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <div className="font-medium text-amber-900">Owner Required</div>
            <div className="text-amber-700 mt-0.5">Select an owner above to enable owner-based access levels</div>
          </div>
        </div>
      )}
    </div>
  );
}

