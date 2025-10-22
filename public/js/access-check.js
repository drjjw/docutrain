// Access check for private documents
import { API_URL } from './config.js';

/**
 * Check if user can access the current document
 * Shows login modal if access is denied
 */
export async function checkDocumentAccess(documentSlug) {
    if (!documentSlug) {
        return true; // No document specified, allow
    }

    try {
        const response = await fetch(`${API_URL}/api/permissions/check-access/${documentSlug}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!data.has_access) {
            // Show login modal
            showLoginModal(documentSlug);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Access check error:', error);
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

