// Landing Page JavaScript

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
            const offsetTop = target.offsetTop - 80; // Account for fixed nav
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

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
