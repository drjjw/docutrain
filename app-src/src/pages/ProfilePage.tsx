import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { Spinner } from '@/components/UI/Spinner';
import { supabase } from '@/lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/utils/errors';
import { getMyProfile, updateMyProfile } from '@/lib/supabase/database';

export function ProfilePage() {
  const { user } = useAuth();
  const { isSuperAdmin, isOwnerAdmin, ownerGroups } = usePermissions();
  const navigate = useNavigate();
  
  // Check if user has admin access (super_admin or owner_admin)
  const hasAdminAccess = isSuperAdmin || isOwnerAdmin;
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'personal' | 'security'>('personal');
  
  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [originalFirstName, setOriginalFirstName] = useState('');
  const [originalLastName, setOriginalLastName] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Update password directly (user is already authenticated)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(getAuthErrorMessage(updateError));
        return;
      }

      setSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Password change error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      
      try {
        setProfileLoading(true);
        const profile = await getMyProfile();
        const first = profile.first_name || '';
        const last = profile.last_name || '';
        const emailValue = profile.email || user.email || '';
        
        setFirstName(first);
        setLastName(last);
        setEmail(emailValue);
        setOriginalFirstName(first);
        setOriginalLastName(last);
        setOriginalEmail(emailValue);
      } catch (err) {
        console.error('Failed to load profile:', err);
        // Fallback to user email if profile fetch fails
        const emailValue = user.email || '';
        setEmail(emailValue);
        setOriginalEmail(emailValue);
      } finally {
        setProfileLoading(false);
      }
    };
    
    loadProfile();
  }, [user?.id, user?.email]);

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    
    try {
      const updates: {
        email?: string;
        first_name?: string;
        last_name?: string;
      } = {};
      
      // Only include fields that have changed
      if (email !== originalEmail) {
        updates.email = email;
      }
      
      if (firstName !== originalFirstName) {
        updates.first_name = firstName || null;
      }
      
      if (lastName !== originalLastName) {
        updates.last_name = lastName || null;
      }
      
      if (Object.keys(updates).length === 0) {
        setProfileError('No changes to save');
        setProfileSaving(false);
        return;
      }
      
      await updateMyProfile(updates);
      
      // Update original values after successful save
      setOriginalFirstName(firstName);
      setOriginalLastName(lastName);
      if (updates.email) {
        setOriginalEmail(email);
      }
      
      setProfileSuccess('Profile updated successfully!');
      
      // If email was updated, the API will handle refreshing the session
      // Reload profile to get updated email if it changed
      if (updates.email) {
        setTimeout(async () => {
          try {
            const profile = await getMyProfile();
            setEmail(profile.email);
            setOriginalEmail(profile.email);
          } catch (err) {
            console.error('Failed to reload profile after email update:', err);
          }
        }, 1000);
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setProfileError(errorMessage);
    } finally {
      setProfileSaving(false);
    }
  };

  // Get user initials for avatar (prefer name, fallback to email)
  const getUserInitials = () => {
    if (firstName || lastName) {
      const firstInitial = firstName?.charAt(0).toUpperCase() || '';
      const lastInitial = lastName?.charAt(0).toUpperCase() || '';
      if (firstInitial && lastInitial) {
        return `${firstInitial}${lastInitial}`;
      }
      return firstInitial || lastInitial || '?';
    }
    if (!user?.email) return '?';
    const email = user.email;
    return email.substring(0, 2).toUpperCase();
  };

  // Get account creation date
  const getAccountCreatedDate = () => {
    if (!user?.created_at) return 'Unknown';
    return new Date(user.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get account status info
  const getAccountStatus = () => {
    // Since user is logged in, they're active
    // Could be extended to check email_confirmed_at, banned_until, etc.
    return {
      text: 'Verified & Active',
      color: 'text-green-600'
    };
  };

  return (
    <Dashboard>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
              {getUserInitials()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Your Profile</h1>
              <p className="text-gray-600">
                {firstName && lastName ? `${firstName} ${lastName}` : user?.email || 'User'}
              </p>
              {firstName && lastName && user?.email && (
                <p className="text-sm text-gray-500 mt-1">{user.email}</p>
              )}
            </div>
            {hasAdminAccess && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('personal')}
                className={`flex-1 px-6 py-4 text-center font-medium text-sm transition-colors ${
                  activeTab === 'personal'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Personal Information
                </div>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex-1 px-6 py-4 text-center font-medium text-sm transition-colors ${
                  activeTab === 'security'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Security Settings
                </div>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Personal Information Tab */}
            {activeTab === 'personal' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Personal Information</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Update your name and email address
                </p>

                {profileLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="sm" />
                  </div>
                ) : (
                  <form onSubmit={handleProfileUpdate} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <Input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                      </label>
                      <Input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email address"
                          className="pl-10"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        You may need to verify your new email address
                      </p>
                    </div>

                    {profileError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex gap-3">
                          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-800">{profileError}</p>
                        </div>
                      </div>
                    )}

                    {profileSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex gap-3">
                          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-green-800 font-medium">{profileSuccess}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={profileSaving}
                        className="flex items-center gap-2"
                      >
                        {profileSaving ? (
                          <>
                            <Spinner size="sm" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Security Settings Tab */}
            {activeTab === 'security' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Security Settings</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Manage your password and security preferences
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-blue-900">Password Change</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Since you're already signed in, you can change your password without entering your current one.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        placeholder="Enter your new password"
                        minLength={6}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 6 characters long
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Confirm your new password"
                        minLength={6}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-shake">
                      <div className="flex gap-3">
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
                      <div className="flex gap-3">
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-green-800 font-medium">{success}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Spinner size="sm" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Update Password
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewPassword('');
                        setConfirmPassword('');
                        setError('');
                        setSuccess('');
                      }}
                      disabled={loading}
                    >
                      Clear
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Account Information Footer */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Owner Assignment</p>
                  <p className="text-sm text-gray-900 font-medium mt-1 break-words">
                    {ownerGroups.length > 0 
                      ? [...new Set(ownerGroups
                          .filter(og => og.role !== 'registered') // Filter out registered role
                          .map(og => og.owner_name)
                          .filter(Boolean) // Remove any null/undefined values
                        )].join(', ') // Deduplicate owner names
                      : isSuperAdmin 
                        ? 'Super Admin' 
                        : 'No assignment'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <svg className={`w-3 h-3 ${getAccountStatus().color}`} fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                    <p className="text-sm text-gray-900 font-medium">{getAccountStatus().text}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-docutrain-light/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-docutrain-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Member Since</p>
                  <p className="text-sm text-gray-900 font-medium mt-1">{getAccountCreatedDate()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dashboard>
  );
}
