// UI Loading - Loading indicators and fun facts rotation
import { getRandomFact } from './facts.js?v=20251019-02';

// Rotate facts with fade effect
let factRotationInterval = null;

function startFactRotation() {
    // Clear any existing interval
    if (factRotationInterval) {
        clearInterval(factRotationInterval);
    }
    
    factRotationInterval = setInterval(() => {
        const factElement = document.querySelector('#loading .fun-fact');
        if (!factElement) {
            clearInterval(factRotationInterval);
            return;
        }
        
        // Fade out
        factElement.classList.add('fade-out');
        
        // Change text and fade in after fade out completes
        setTimeout(() => {
            factElement.innerHTML = getRandomFact();
            factElement.classList.remove('fade-out');
            factElement.classList.add('fade-in');
            
            // Remove fade-in class after animation
            setTimeout(() => {
                factElement.classList.remove('fade-in');
            }, 600);
        }, 600);
    }, 8000); // Change fact every 8 seconds
}

// Add loading indicator with rotating fun facts
export function addLoading(chatContainer) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loading';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-container';
    
    // Loading dots
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'loading-dots';
    dotsDiv.innerHTML = '<span></span><span></span><span></span>';
    
    // Fun fact display
    const factDiv = document.createElement('div');
    factDiv.className = 'fun-fact';
    factDiv.innerHTML = getRandomFact();
    
    contentDiv.appendChild(dotsDiv);
    contentDiv.appendChild(factDiv);
    loadingDiv.appendChild(contentDiv);
    chatContainer.appendChild(loadingDiv);
    
    // Scroll to show the loading indicator at the top
    loadingDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Start rotating facts every 5 seconds with fade animation
    startFactRotation();
}

// Remove loading indicator
export function removeLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.remove();
    }
    
    // Clear the fact rotation interval
    if (factRotationInterval) {
        clearInterval(factRotationInterval);
        factRotationInterval = null;
    }
}

