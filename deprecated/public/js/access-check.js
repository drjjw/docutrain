// Access check for private documents
import { API_URL } from './config.js';

// Helper to safely use debugLog (fallback to console if not available yet)
const log = {
    verbose: (...args) => window.debugLog ? window.debugLog.verbose(...args) : console.log(...args),
    normal: (...args) => window.debugLog ? window.debugLog.normal(...args) : console.log(...args),
    quiet: (...args) => window.debugLog ? window.debugLog.quiet(...args) : console.log(...args),
    always: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

/**
 * Get JWT token from Supabase localStorage
 */
function getSupabaseToken() {
    try {
        // Supabase stores session in localStorage with key: sb-[project-ref]-auth-token
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);

        if (!sessionData) {
            log.verbose('🔒 No Supabase session found in localStorage');
            return null;
        }

        const session = JSON.parse(sessionData);
        const token = session?.access_token;

        if (token) {
            log.verbose('🔑 Found Supabase JWT token');
        } else {
            log.verbose('🔒 No access token in Supabase session');
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
 * @param {string} documentSlug - The document slug to check
 * @param {string} passcode - Optional passcode to validate
 * @returns {Promise<boolean>} - True if access granted, false otherwise
 */
export async function checkDocumentAccess(documentSlug, passcode = null) {
    if (!documentSlug) {
        return true; // No document specified, allow
    }

    log.verbose('🔒 Checking access to document:', documentSlug);

    try {
        // Get JWT token from Supabase session
        const token = getSupabaseToken();
        const headers = {
            'Content-Type': 'application/json',
        };

        // Add Authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            log.verbose('🔑 Sending JWT token with access check request');
        } else {
            log.verbose('⚠️ No JWT token available - checking as unauthenticated user');
        }

        // Build request body with optional passcode
        const body = {};
        if (passcode) {
            body.passcode = passcode;
            log.verbose('🔐 Sending passcode with access check request');
        }

        const response = await fetch(`${API_URL}/api/permissions/check-access/${documentSlug}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        log.verbose('🔍 Access check response status:', response.status);

        const data = await response.json();
        log.verbose('🔍 Access check result:', data);

        if (!data.has_access) {
            log.verbose('🚫 Access denied for document:', documentSlug);
            
            // Handle different error types
            if (data.error_type === 'passcode_required') {
                showPasscodeModal(documentSlug, data.document_info);
            } else if (data.error_type === 'passcode_incorrect') {
                // Incorrect passcode - this should only happen during validation in the modal
                // Return false to trigger validation error in the modal
                return false;
            } else if (data.error_type === 'document_not_found') {
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

        log.verbose('✅ Access granted for document:', documentSlug);
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
 * Show a passcode modal for passcode-protected documents
 */
function showPasscodeModal(documentSlug, documentInfo) {
    const docTitle = documentInfo?.title || documentSlug;
    
    Swal.fire({
        icon: 'info',
        title: 'Passcode Required',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 15px; color: #333;">
                    The document "<strong>${docTitle}</strong>" requires a passcode to access.
                </p>
                <p style="margin-bottom: 15px; color: #333;">
                    <strong>Please enter the passcode:</strong>
                </p>
            </div>
        `,
        input: 'password',
        inputPlaceholder: 'Enter passcode',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off',
            autocomplete: 'off'
        },
        showCancelButton: true,
        cancelButtonText: 'Go Back',
        confirmButtonText: 'Submit',
        confirmButtonColor: '#3b82f6',
        allowOutsideClick: false,
        allowEscapeKey: false,
        inputValidator: (value) => {
            if (!value) {
                return 'Please enter a passcode';
            }
        },
        preConfirm: async (passcode) => {
            // Show loading state
            Swal.showLoading();
            
            try {
                // Re-check access with passcode
                const result = await checkDocumentAccess(documentSlug, passcode);
                
                if (result) {
                    // Access granted - return the passcode so we can add it to URL
                    return passcode;
                } else {
                    // Access denied - show error
                    Swal.showValidationMessage('Incorrect passcode. Please try again.');
                    return false;
                }
            } catch (error) {
                console.error('Passcode validation error:', error);
                Swal.showValidationMessage('Error validating passcode. Please try again.');
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            // Access granted - add passcode to URL and reload
            const passcode = result.value;
            log.verbose('✅ Passcode accepted, adding to URL and reloading page');
            
            // Add passcode to URL parameters
            const url = new URL(window.location.href);
            url.searchParams.set('passcode', passcode);
            window.location.href = url.toString();
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
    const ownerLogo = documentInfo?.owner?.logo_url;
    const ownerName = documentInfo?.owner?.name;
    
    // Build logo HTML if available
    let logoHtml = '';
    if (ownerLogo) {
        logoHtml = `
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="${ownerLogo}" 
                     alt="${ownerName || 'Owner'} logo" 
                     style="max-width: 150px; max-height: 80px; object-fit: contain;" />
            </div>
        `;
    }
    
    // Use SweetAlert2 which is already loaded
    Swal.fire({
        icon: ownerLogo ? undefined : 'info', // Hide icon if we have a logo
        title: 'Login Required',
        html: `
            ${logoHtml}
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

            // Store owner info for login branding if available
            if (documentInfo?.owner) {
                sessionStorage.setItem('auth_owner_info', JSON.stringify(documentInfo.owner));
            }

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
    // Get document and passcode from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const docParam = urlParams.get('doc');
    const passcodeParam = urlParams.get('passcode');

    if (docParam) {
        // Handle multi-document URLs by parsing on + or space (URL decoding)
        const documentSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);

        log.verbose('🔒 Checking access to documents:', documentSlugs.join(', '));
        if (passcodeParam) {
            log.verbose('🔐 Passcode found in URL parameters');
        }

        // For multi-document URLs, check access for each document
        if (documentSlugs.length > 1) {
            // Check each document individually (passcode applies to all if provided)
            Promise.all(documentSlugs.map(slug => checkDocumentAccess(slug, passcodeParam)))
                .then(results => {
                    const allGranted = results.every(result => result === true);
                    if (!allGranted) {
                        log.verbose('🚫 Access denied for one or more documents in multi-doc URL');
                    } else {
                        log.verbose('✅ Access granted for all documents in multi-doc URL');
                    }
                })
                .catch(error => {
                    console.error('❌ Error checking multi-document access:', error);
                });
        } else {
            // Single document - check normally with optional passcode
            checkDocumentAccess(documentSlugs[0], passcodeParam);
        }
    }
}

