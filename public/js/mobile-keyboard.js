// Mobile keyboard handling to prevent input overlap
// Adjusts chat container height when virtual keyboard appears

export function initializeMobileKeyboardSupport(elements) {
    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    const inputContainer = document.querySelector('.input-container');
    const chatContainer = document.querySelector('.chat-container');
    
    if (!inputContainer || !chatContainer) return;

    let initialViewportHeight = window.innerHeight;
    let keyboardHeight = 0;

    // Handle viewport changes (keyboard show/hide)
    function handleViewportChange() {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // If height decreased significantly, keyboard is likely open
        if (heightDifference > 150) {
            keyboardHeight = heightDifference;
            // Adjust chat container height to prevent overlap
            chatContainer.style.height = `calc(100vh - ${keyboardHeight}px - 200px)`;
            chatContainer.style.minHeight = '200px';
            
            // Scroll to bottom to keep input visible
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 100);
        } else {
            // Keyboard closed, reset heights
            keyboardHeight = 0;
            chatContainer.style.height = '';
            chatContainer.style.minHeight = '';
        }
    }

    // Listen for resize events
    window.addEventListener('resize', handleViewportChange);
    
    // Listen for focus events on input to ensure proper scrolling
    if (elements.messageInput) {
        elements.messageInput.addEventListener('focus', () => {
            setTimeout(() => {
                handleViewportChange();
                // Scroll chat to bottom when input is focused
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 300); // Delay to allow keyboard animation
        });

        // Listen for blur events
        elements.messageInput.addEventListener('blur', () => {
            setTimeout(() => {
                handleViewportChange();
            }, 300);
        });
    }

    console.log('📱 Mobile keyboard support initialized');
}

