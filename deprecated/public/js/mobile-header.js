// Mobile header auto-hide functionality
// Hides header when scrolling down, shows when scrolling up

export function initializeMobileHeaderBehavior() {
    // Only activate on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile || window.innerWidth > 768) return;

    const header = document.getElementById('mainHeader');
    const chatContainer = document.querySelector('.chat-container');
    const messageInput = document.getElementById('messageInput');
    const headerToggle = document.getElementById('mobileHeaderToggle');

    if (!header || !chatContainer || !headerToggle) return;

    let lastScrollTop = 0;
    let scrollThreshold = 50; // pixels to scroll before hiding
    let hideTimeout;
    let isHeaderHidden = false;

    // Function to show header
    function showHeader() {
        header.classList.remove('hidden');
        headerToggle.classList.remove('show');
        isHeaderHidden = false;
        clearTimeout(hideTimeout);
    }

    // Function to hide header
    function hideHeader() {
        if (!messageInput.matches(':focus')) { // Don't hide if input is focused
            header.classList.add('hidden');
            headerToggle.classList.add('show');
            isHeaderHidden = true;
        }
    }

    // Toggle button click handler
    headerToggle.addEventListener('click', () => {
        showHeader();
        autoHideHeader(); // Will auto-hide after delay
    });

    // Function to auto-hide header after delay
    function autoHideHeader() {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            hideHeader();
        }, 2000); // Hide after 2 seconds of inactivity
    }

    // Scroll detection for auto-hide
    function handleScroll() {
        const currentScrollTop = chatContainer.scrollTop;

        // Show header when scrolling up significantly
        if (currentScrollTop < lastScrollTop - scrollThreshold) {
            showHeader();
            autoHideHeader(); // Will auto-hide after delay
        }
        // Hide header when scrolling down
        else if (currentScrollTop > lastScrollTop + scrollThreshold) {
            hideHeader();
        }

        lastScrollTop = currentScrollTop;
    }

    // Touch events to show header temporarily
    function handleTouchStart() {
        showHeader();
    }

    // Input focus events
    messageInput.addEventListener('focus', () => {
        showHeader();
        clearTimeout(hideTimeout); // Don't auto-hide while typing
    });

    messageInput.addEventListener('blur', () => {
        autoHideHeader(); // Start auto-hide timer when input loses focus
    });

    // Add scroll listener to chat container
    chatContainer.addEventListener('scroll', handleScroll, { passive: true });

    // Add touch listeners to show header on interaction
    document.addEventListener('touchstart', handleTouchStart, { passive: true });

    // Show header initially for a brief moment, then auto-hide
    setTimeout(() => {
        autoHideHeader();
    }, 1000);

    console.log('📱 Mobile header auto-hide behavior initialized');
}

