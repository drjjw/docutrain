// Access check for private documents
import { API_URL } from './config.js';

/**
 * Get JWT token from Supabase localStorage
 */
function getSupabaseToken() {
    try {
        // Supabase stores session in localStorage with key: sb-[project-ref]-auth-token
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);

        if (!sessionData) {
            console.log('🔒 No Supabase session found in localStorage');
            return null;
        }

        const session = JSON.parse(sessionData);
        const token = session?.access_token;

        if (token) {
            console.log('🔑 Found Supabase JWT token');
        } else {
            console.log('🔒 No access token in Supabase session');
        }

        return token;
    } catch (error) {
        console.error('Error getting Supabase token:', error);
        return null;
    }
}

/**
 * Check if user can access the current document
 * Shows login modal if access is denied
 */
export async function checkDocumentAccess(documentSlug) {
    if (!documentSlug) {
        return true; // No document specified, allow
    }

    console.log('🔒 Checking access to document:', documentSlug);

    try {
        // Get JWT token from Supabase session
        const token = getSupabaseToken();
        const headers = {
            'Content-Type': 'application/json',
        };

        // Add Authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('🔑 Sending JWT token with access check request');
        } else {
            console.log('⚠️ No JWT token available - checking as unauthenticated user');
        }

        const response = await fetch(`${API_URL}/api/permissions/check-access/${documentSlug}`, {
            method: 'POST',
            headers: headers,
        });

        console.log('🔍 Access check response status:', response.status);

        const data = await response.json();
        console.log('🔍 Access check result:', data);

        if (!data.has_access) {
            console.log('🚫 Access denied for document:', documentSlug);
            // Show login modal
            showLoginModal(documentSlug);
            return false;
        }

        console.log('✅ Access granted for document:', documentSlug);
        return true;
    } catch (error) {
        console.error('❌ Access check error:', error);
        // On error, allow access (fail open for public docs)
        return true;
    }
}

/**
 * Show a beautiful login modal for restricted documents
 */
function showLoginModal(documentSlug) {
    // Use SweetAlert2 which is already loaded
    Swal.fire({
        icon: 'info',
        title: 'Login Required',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 15px;">
                    This document requires authentication to access.
                </p>
                <p style="margin-bottom: 15px;">
                    <strong>Please sign in to continue</strong>
                </p>
                <p style="font-size: 14px; color: #666;">
                    Don't have an account? You can create one after clicking the button below.
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Go to Login',
        confirmButtonColor: '#3b82f6',
        cancelButtonText: 'View Public Documents',
        cancelButtonColor: '#6b7280',
        allowOutsideClick: false,
        allowEscapeKey: false,
    }).then((result) => {
        if (result.isConfirmed) {
            // Store current URL for redirect after login
            sessionStorage.setItem('auth_return_url', window.location.href);
            // Redirect to login page
            window.location.href = '/app/login';
        } else {
            // Redirect to home (public documents)
            window.location.href = '/';
        }
    });
}

/**
 * Initialize access check on page load
 */
export function initAccessCheck() {
    // Get document from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const documentSlug = urlParams.get('doc');

    if (documentSlug) {
        console.log('🔒 Checking access to document:', documentSlug);
        checkDocumentAccess(documentSlug);
    }
}

