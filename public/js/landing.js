// Landing Page JavaScript

// Beta Banner Dismissal
function initBetaBanner() {
    const betaBanner = document.getElementById('betaBanner');
    const betaBannerClose = document.getElementById('betaBannerClose');
    const nav = document.querySelector('.nav');
    const mobileMenu = document.getElementById('mobileMenu');
    const hero = document.querySelector('.hero');
    const STORAGE_KEY = 'betaBannerDismissed';
    
    if (!betaBanner || !betaBannerClose) return;
    
    // Function to adjust nav and mobile menu positions based on banner visibility
    function adjustPositions() {
        const bannerHeight = betaBanner.offsetHeight;
        const navHeight = nav ? nav.offsetHeight : 73;
        
        if (!betaBanner.classList.contains('hidden')) {
            // Banner is visible - position nav below banner
            if (nav) {
                nav.style.top = `${bannerHeight}px`;
            }
            if (mobileMenu) {
                mobileMenu.style.top = `${bannerHeight + navHeight}px`;
            }
            // Set CSS custom property for banner height
            document.documentElement.style.setProperty('--banner-height', `${bannerHeight}px`);
        } else {
            // Banner is hidden - reset positions
            if (nav) {
                nav.style.top = '0';
            }
            if (mobileMenu) {
                mobileMenu.style.top = `${navHeight}px`;
            }
            document.documentElement.style.setProperty('--banner-height', '0');
        }
    }
    
    // Function to adjust hero padding based on banner visibility
    function adjustHeroPadding() {
        if (hero && !betaBanner.classList.contains('hidden')) {
            // Banner is visible - add extra padding for banner + nav
            const bannerHeight = betaBanner.offsetHeight;
            const navHeight = nav ? nav.offsetHeight : 73;
            hero.style.paddingTop = `calc(6rem + ${bannerHeight + navHeight}px)`;
        } else if (hero) {
            // Banner is hidden - add padding for nav only
            const navHeight = nav ? nav.offsetHeight : 73;
            hero.style.paddingTop = `calc(6rem + ${navHeight}px)`;
        }
    }
    
    // Check if banner was previously dismissed
    const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (isDismissed) {
        betaBanner.classList.add('hidden');
        // Initialize CSS custom property even when hidden
        document.documentElement.style.setProperty('--banner-height', '0');
    } else {
        // Initialize CSS custom property with banner height
        const bannerHeight = betaBanner.offsetHeight;
        document.documentElement.style.setProperty('--banner-height', `${bannerHeight}px`);
    }
    
    // Adjust positions and padding initially
    adjustPositions();
    adjustHeroPadding();
    
    // Adjust on window resize
    window.addEventListener('resize', () => {
        adjustPositions();
        adjustHeroPadding();
    });
    
    // Handle close button click
    betaBannerClose.addEventListener('click', () => {
        betaBanner.classList.add('hidden');
        localStorage.setItem(STORAGE_KEY, 'true');
        adjustPositions();
        adjustHeroPadding();
    });
}

// Initialize beta banner when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBetaBanner);
} else {
    initBetaBanner();
}

// Mobile menu toggle
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileMenu = document.getElementById('mobileMenu');

if (mobileMenuToggle && mobileMenu) {
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        
        // Animate hamburger icon
        const spans = mobileMenuToggle.querySelectorAll('span');
        if (mobileMenu.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translateY(10px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translateY(-10px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });
    
    // Close mobile menu when clicking a link
    const mobileMenuLinks = mobileMenu.querySelectorAll('a');
    mobileMenuLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            const spans = mobileMenuToggle.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        });
    });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            // Calculate offset: nav height + banner height (if visible) + padding
            const nav = document.querySelector('.nav');
            const banner = document.getElementById('betaBanner');
            const navHeight = nav ? nav.offsetHeight : 73;
            const bannerHeight = banner && !banner.classList.contains('hidden') ? banner.offsetHeight : 0;
            const offsetTop = target.offsetTop - navHeight - bannerHeight - 20;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Handle hash navigation on page load (for links from other pages)
function handleHashNavigation() {
    if (window.location.hash) {
        const hash = window.location.hash;
        const target = document.querySelector(hash);
        if (target) {
            // Wait for page to fully render
            setTimeout(() => {
                const nav = document.querySelector('.nav');
                const banner = document.getElementById('betaBanner');
                const navHeight = nav ? nav.offsetHeight : 73;
                const bannerHeight = banner && !banner.classList.contains('hidden') ? banner.offsetHeight : 0;
                const headerHeight = navHeight + bannerHeight + 20; // nav + banner + padding
                const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleHashNavigation);
} else {
    handleHashNavigation();
}

// Add scroll effect to navigation
let lastScroll = 0;
const nav = document.querySelector('.nav');

if (nav) {
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            nav.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        } else {
            nav.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });
}

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.feature-card, .step, .about-card, .rationale-benefit-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Conversation rotation for hero cards
function initConversationRotation() {
    const conversations = document.querySelectorAll('[data-conversation]');
    if (conversations.length === 0) return;

    let currentConversation = 1;
    const totalConversations = 3; // Total number of conversations
    const conversationDuration = 4000; // Show each conversation for 4 seconds

    function showConversation(num) {
        // Hide all conversations
        conversations.forEach(card => {
            card.classList.remove('conversation-active');
            card.classList.add('conversation-hidden');
        });

        // Show the selected conversation
        const activeCards = document.querySelectorAll(`[data-conversation="${num}"]`);
        activeCards.forEach(card => {
            card.classList.remove('conversation-hidden');
            card.classList.add('conversation-active');
        });
    }

    // Rotate conversations
    function rotateConversations() {
        currentConversation = (currentConversation % totalConversations) + 1;
        showConversation(currentConversation);
    }

    // Start rotation after initial delay
    setTimeout(() => {
        setInterval(rotateConversations, conversationDuration);
    }, conversationDuration);
}

// Initialize conversation rotation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConversationRotation);
} else {
    initConversationRotation();
}

// Chat Modal Functionality - Using embed code pattern
function initChatModal() {
    const tryDocutrainBtn = document.getElementById('tryDocutrainBtn');
    const modal = document.getElementById('docutrain-chat-modal');
    const iframe = document.getElementById('docutrain-chat-iframe');
    const closeBtn = document.getElementById('closeDocutrainChatBtn');
    
    if (!tryDocutrainBtn || !modal || !iframe) return;
    
    const chatUrl = '/app/chat?doc=docutrain-today&footer=false';
    let iframeLoaded = false;
    let scrollPosition = 0;
    
    function preventScroll() {
        scrollPosition = window.pageYOffset;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = '-' + scrollPosition + 'px';
        document.body.style.width = '100%';
    }
    
    function allowScroll() {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollPosition);
    }
    
    function openModal() {
        // Set iframe src IMMEDIATELY to prevent flash of parent domain
        if (!iframeLoaded) {
            iframe.src = chatUrl;
            iframeLoaded = true;
        }
        
        // Show modal
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
        document.body.classList.add('docutrain-modal-open');
        preventScroll();
    }
    
    function closeModal() {
        modal.classList.remove('active');
        document.body.classList.remove('docutrain-modal-open');
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        
        allowScroll();
    }
    
    // Open in new window when button is clicked
    tryDocutrainBtn.addEventListener('click', () => {
        window.open(chatUrl, '_blank', 'noopener,noreferrer');
    });
    
    // Close modal when close button is clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

// Initialize chat modal when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatModal);
} else {
    initChatModal();
}
