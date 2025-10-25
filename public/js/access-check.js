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
 * Shows appropriate modal based on error type
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
            
            // Handle different error types
            if (data.error_type === 'document_not_found') {
                showDocumentNotFoundModal(documentSlug);
            } else if (data.error_type === 'authentication_required') {
                showLoginModal(documentSlug, data.document_info);
            } else if (data.error_type === 'permission_denied') {
                showPermissionDeniedModal(documentSlug, data.document_info);
            } else {
                // Fallback to login modal for unknown errors
                showLoginModal(documentSlug, data.document_info);
            }
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
 * Show a modal for document not found
 */
function showDocumentNotFoundModal(documentSlug) {
    Swal.fire({
        icon: 'error',
        title: 'Document Not Found',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 15px; color: #333;">
                    The document "<strong>${documentSlug}</strong>" could not be found.
                </p>
                <p style="margin-bottom: 15px; color: #333;">
                    This might be because:
                </p>
                <ul style="margin-left: 20px; margin-bottom: 15px; color: #333;">
                    <li>The document slug is incorrect</li>
                    <li>The document has been removed or renamed</li>
                    <li>The document is not yet available</li>
                </ul>
                <p style="font-size: 14px; color: #333;">
                    Please check the URL or contact the administrator if you believe this is an error.
                </p>
            </div>
        `,
        showCancelButton: true,
        cancelButtonText: 'Go Back',
        confirmButtonText: 'Try Different Document',
        confirmButtonColor: '#3b82f6',
        allowOutsideClick: false,
        allowEscapeKey: false,
    }).then((result) => {
        if (result.isConfirmed) {
            // Redirect to document selector or home
            window.location.href = '/';
        } else if (result.isDismissed) {
            // Go back in browser history
            window.history.back();
        }
    });
}

/**
 * Show a modal for permission denied (user is logged in but no access)
 */
function showPermissionDeniedModal(documentSlug, documentInfo) {
    const docTitle = documentInfo?.title || documentSlug;
    Swal.fire({
        icon: 'warning',
        title: 'Access Denied',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 15px; color: #333;">
                    You don't have permission to access "<strong>${docTitle}</strong>".
                </p>
                <p style="margin-bottom: 15px; color: #333;">
                    This document may be restricted to specific user groups or organizations.
                </p>
                <p style="font-size: 14px; color: #333;">
                    If you believe you should have access, please contact the document administrator.
                </p>
            </div>
        `,
        showCancelButton: true,
        cancelButtonText: 'Go Back',
        confirmButtonText: 'Try Different Document',
        confirmButtonColor: '#3b82f6',
        allowOutsideClick: false,
        allowEscapeKey: false,
    }).then((result) => {
        if (result.isConfirmed) {
            // Redirect to document selector or home
            window.location.href = '/';
        } else if (result.isDismissed) {
            // Go back in browser history
            window.history.back();
        }
    });
}

/**
 * Show a beautiful login modal for restricted documents
 */
function showLoginModal(documentSlug, documentInfo) {
    const docTitle = documentInfo?.title || documentSlug;
    // Use SweetAlert2 which is already loaded
    Swal.fire({
        icon: 'info',
        title: 'Login Required',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 15px; color: #333;">
                    The document "<strong>${docTitle}</strong>" requires authentication to access.
                </p>
                <p style="margin-bottom: 15px; color: #333;">
                    <strong>Please sign in to continue</strong>
                </p>
                <p style="font-size: 14px; color: #333;">
                    Don't have an account? You can create one after clicking the button below.
                </p>
            </div>
        `,
        showCancelButton: true,
        cancelButtonText: 'Go Back',
        confirmButtonText: 'Go to Login',
        confirmButtonColor: '#3b82f6',
        allowOutsideClick: false,
        allowEscapeKey: false,
    }).then((result) => {
        if (result.isConfirmed) {
            // Store current URL for redirect after login
            sessionStorage.setItem('auth_return_url', window.location.href);
            // Redirect to login page
            window.location.href = '/app/login';
        } else if (result.isDismissed) {
            // Go back in browser history
            window.history.back();
        }
    });
}

/**
 * Initialize access check on page load
 */
export function initAccessCheck() {
    // Get document from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const docParam = urlParams.get('doc');

    if (docParam) {
        // Handle multi-document URLs by parsing on + or space (URL decoding)
        const documentSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);

        console.log('🔒 Checking access to documents:', documentSlugs.join(', '));

        // For multi-document URLs, check access for each document
        if (documentSlugs.length > 1) {
            // Check each document individually
            Promise.all(documentSlugs.map(slug => checkDocumentAccess(slug)))
                .then(results => {
                    const allGranted = results.every(result => result === true);
                    if (!allGranted) {
                        console.log('🚫 Access denied for one or more documents in multi-doc URL');
                    } else {
                        console.log('✅ Access granted for all documents in multi-doc URL');
                    }
                })
                .catch(error => {
                    console.error('❌ Error checking multi-document access:', error);
                });
        } else {
            // Single document - check normally
            checkDocumentAccess(documentSlugs[0]);
        }
    }
}

