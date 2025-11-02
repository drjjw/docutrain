// Rating submission functionality
import { API_URL } from './config.js';

// Submit rating for a conversation
export async function submitRating(conversationId, rating, ratingContainer) {
    try {
        const response = await fetch(`${API_URL}/api/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversationId: conversationId,
                rating: rating
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Update the rating container to show "Thanks!" with the selected button
            const questionDiv = ratingContainer.querySelector('.rating-question');
            const buttonsDiv = ratingContainer.querySelector('.rating-buttons');
            const buttons = buttonsDiv.querySelectorAll('.rating-btn');

            // Add rated class for flex layout
            ratingContainer.classList.add('rated');

            // Change question to "Thanks!" and style it
            questionDiv.textContent = 'Thanks!';
            questionDiv.className = 'rating-thanks';

            // Hide the non-selected button and style the selected one
            buttons.forEach(btn => {
                if (!btn.classList.contains(rating === 'thumbs_up' ? 'thumbs-up' : 'thumbs-down')) {
                    btn.style.display = 'none';
                } else {
                    // Style the selected button
                    btn.classList.add('rated');
                    btn.disabled = true;
                    btn.title = 'Thank you for your feedback!';
                }
            });

            console.log(`✓ Rating submitted: ${rating} for conversation ${conversationId}`);
        } else {
            console.error('Failed to submit rating:', data.error);
            alert('Failed to submit rating. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting rating:', error);
        alert('Failed to submit rating. Please check your connection and try again.');
    }
}

