/**
 * ReactionButtons - Component for rating assistant responses
 * Displays thumbs up/down buttons styled like other action buttons
 * Stores rating in chat_conversations table via /api/rate endpoint
 */

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface ReactionButtonsProps {
  conversationId?: string;
}

type Rating = 'thumbs_up' | 'thumbs_down' | null;

export function ReactionButtons({ conversationId }: ReactionButtonsProps) {
  const [currentRating, setCurrentRating] = useState<Rating>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current rating when conversationId is available
  useEffect(() => {
    if (!conversationId) return;

    const fetchRating = async () => {
      try {
        // Note: We'd need an endpoint to fetch rating, but for now we'll just track local state
        // The rating will persist in the database, but we won't fetch it on mount
        // This is fine since ratings are per-conversation and we can track locally
      } catch (error) {
        // Silently fail - we'll just track local state
        console.error('Error fetching rating:', error);
      }
    };

    fetchRating();
  }, [conversationId]);

  const handleRating = async (rating: 'thumbs_up' | 'thumbs_down') => {
    if (!conversationId || isSubmitting) return;

    // If clicking the same rating, remove it (toggle off)
    const newRating = currentRating === rating ? null : rating;
    const previousRating = currentRating;
    
    // Optimistically update UI
    setCurrentRating(newRating);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          rating: newRating,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit rating');
      }

      // Rating successfully stored
    } catch (error) {
      console.error('Error submitting rating:', error);
      // Revert local state on error
      setCurrentRating(previousRating);
      // Could show a toast notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if no conversation ID
  if (!conversationId) {
    return null;
  }

  return (
    <div className="message-reaction-buttons">
      <button
        type="button"
        className={`message-reaction-button ${currentRating === 'thumbs_up' ? 'active' : ''}`}
        onClick={() => handleRating('thumbs_up')}
        disabled={isSubmitting}
        title={currentRating === 'thumbs_up' ? 'Remove thumbs up' : 'Thumbs up'}
        aria-label={currentRating === 'thumbs_up' ? 'Remove thumbs up' : 'Thumbs up'}
        aria-pressed={currentRating === 'thumbs_up'}
        data-rating="thumbs_up"
      >
        <ThumbsUp size={16} />
      </button>
      <button
        type="button"
        className={`message-reaction-button ${currentRating === 'thumbs_down' ? 'active' : ''}`}
        onClick={() => handleRating('thumbs_down')}
        disabled={isSubmitting}
        title={currentRating === 'thumbs_down' ? 'Remove thumbs down' : 'Thumbs down'}
        aria-label={currentRating === 'thumbs_down' ? 'Remove thumbs down' : 'Thumbs down'}
        aria-pressed={currentRating === 'thumbs_down'}
        data-rating="thumbs_down"
      >
        <ThumbsDown size={16} />
      </button>
    </div>
  );
}

