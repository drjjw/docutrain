// AI Hint Message - Dismissible with Cookie
// Shows a discrete message above the chat input suggesting users can ask questions

const COOKIE_NAME = 'ai_hint_dismissed';
const COOKIE_EXPIRY_DAYS = 365; // Remember dismissal for 1 year

/**
 * Initialize the AI hint message functionality
 * Shows the message if it hasn't been dismissed, handles dismiss action
 */
export function initializeAIHint() {
    const hintMessage = document.getElementById('aiHintMessage');
    const dismissButton = document.getElementById('aiHintDismiss');
    
    if (!hintMessage || !dismissButton) {
        console.warn('AI hint elements not found');
        return;
    }
    
    // Check if user has previously dismissed the hint
    const isDismissed = Cookies.get(COOKIE_NAME);
    
    if (!isDismissed) {
        // Show the hint message with a slight delay for better UX
        setTimeout(() => {
            hintMessage.style.display = 'flex';
        }, 500);
    }
    
    // Handle dismiss button click
    dismissButton.addEventListener('click', () => {
        dismissHint(hintMessage);
    });
}

/**
 * Dismiss the hint message and save preference in cookie
 * @param {HTMLElement} hintMessage - The hint message element
 */
function dismissHint(hintMessage) {
    // Fade out animation
    hintMessage.style.opacity = '0';
    hintMessage.style.transform = 'translateY(-10px)';
    
    // Remove from DOM after animation
    setTimeout(() => {
        hintMessage.style.display = 'none';
    }, 300);
    
    // Save dismissal preference in cookie (expires in 1 year)
    Cookies.set(COOKIE_NAME, 'true', { expires: COOKIE_EXPIRY_DAYS });
    
    console.log('✓ AI hint dismissed and saved to cookie');
}

/**
 * Reset the hint (useful for testing or if user wants to see it again)
 * Call this from console: window.resetAIHint()
 */
export function resetAIHint() {
    Cookies.remove(COOKIE_NAME);
    const hintMessage = document.getElementById('aiHintMessage');
    if (hintMessage) {
        hintMessage.style.display = 'flex';
        hintMessage.style.opacity = '1';
        hintMessage.style.transform = 'translateY(0)';
    }
    console.log('✓ AI hint reset - will show on next page load');
}

// Expose reset function globally for debugging
if (typeof window !== 'undefined') {
    window.resetAIHint = resetAIHint;
}

