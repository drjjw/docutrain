// UI Loading - Loading indicators and fun facts rotation
import { getRandomFact } from './facts.js';

// Rotate facts with fade effect (owner-aware)
let factRotationInterval = null;

function startFactRotation(owner = null) {
    // Clear any existing interval
    if (factRotationInterval) {
        clearInterval(factRotationInterval);
    }

    // Only start rotation if facts are enabled for this owner
    if (getRandomFact(owner) === null) {
        return; // No rotation for owners without facts
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
            factElement.innerHTML = getRandomFact(owner);
            factElement.classList.remove('fade-out');
            factElement.classList.add('fade-in');

            // Remove fade-in class after animation
            setTimeout(() => {
                factElement.classList.remove('fade-in');
            }, 600);
        }, 600);
    }, 8000); // Change fact every 8 seconds
}

// Add loading indicator with rotating fun facts (owner-aware)
export function addLoading(chatContainer, owner = null) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loading';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-container';

    // Loading dots
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'loading-dots';
    dotsDiv.innerHTML = '<span></span><span></span><span></span>';

    // Fun fact display (only for ukidney documents)
    const initialFact = getRandomFact(owner);
    if (initialFact) {
        const factDiv = document.createElement('div');
        factDiv.className = 'fun-fact';
        factDiv.innerHTML = initialFact;
        contentDiv.appendChild(factDiv);

        // Start rotating facts only if facts are enabled for this owner
        startFactRotation(owner);
    }

    contentDiv.appendChild(dotsDiv);
    loadingDiv.appendChild(contentDiv);
    chatContainer.appendChild(loadingDiv);

    // Scroll to show the loading indicator at the top
    loadingDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

