/**
 * Disclaimer Module
 * 
 * Handles the display of a SweetAlert2 disclaimer modal for educational use.
 * Uses cookies to remember user consent and prevent repeated displays.
 * 
 * Dependencies:
 * - SweetAlert2 (loaded via CDN in index.html)
 * - js-cookie (loaded via CDN in index.html)
 * - Animate.css (loaded via CDN in index.html)
 */

const COOKIE_NAME = '_ukidney_disclaimer_agree';
// Session cookie - expires when browser closes (no expiry date set)

/**
 * Shows the disclaimer modal if the user hasn't agreed yet
 */
export function showDisclaimerIfNeeded() {
    // Check if running in an iframe (parent handles disclaimer)
    if (window.self !== window.top) {
        console.log('🖼️  Running in iframe - disclaimer handled by parent');
        return;
    }

    // Check if user has already agreed
    if (Cookies.get(COOKIE_NAME)) {
        console.log('✅ Disclaimer already accepted');
        return;
    }

    // Show disclaimer after a short delay for better UX
    setTimeout(() => {
        showDisclaimer();
    }, 500);
}

/**
 * Displays the disclaimer modal using SweetAlert2
 */
function showDisclaimer() {
    Swal.fire({
        title: '<i class="swal2-icon swal2-warning"></i> Important Disclaimer',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 15px;">
                    This feature is intended <strong>for educational use only by healthcare professionals</strong>.
                </p>
                <p style="margin-bottom: 15px;">
                    Please verify all suggestions before considering use in patient care settings.
                </p>
                <p>
                    If you agree with these terms, please acknowledge below, otherwise close this window.
                </p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="swal2-icon swal2-success"></i> I agree',
        cancelButtonText: '<i class="swal2-icon swal2-error"></i> I decline',
        customClass: {
            confirmButton: 'swal2-confirm-button',
            cancelButton: 'swal2-cancel-button',
            htmlContainer: 'swal2-html-container',
            popup: 'animated-popup'
        },
        buttonsStyling: false,
        showClass: {
            popup: 'animate__animated animate__fadeIn animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOut animate__faster'
        },
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false
    }).then((result) => {
        if (result.isConfirmed) {
            // User agreed - set session cookie (expires when browser closes)
            Cookies.set(COOKIE_NAME, 'Yes', { 
                path: '/'
                // No expires property = session cookie
            });
            console.log('✅ User accepted disclaimer (session only)');
        } else if (result.isDismissed) {
            // User declined - redirect to goodbye page
            console.log('❌ User declined disclaimer');
            window.location.href = "/goodbye";
        }
    });
}

/**
 * Clears the disclaimer cookie (useful for testing)
 */
export function clearDisclaimerCookie() {
    Cookies.remove(COOKIE_NAME, { path: '/' });
    console.log('🗑️  Disclaimer cookie cleared');
}

/**
 * Checks if user has accepted the disclaimer
 */
export function hasAcceptedDisclaimer() {
    return !!Cookies.get(COOKIE_NAME);
}

