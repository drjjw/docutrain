/**
 * ShareButton - Component for sharing conversations via shareable links
 * Displays share icon and handles copying share URL to clipboard
 * Hides button if conversation is banned
 */

import { useState, useEffect } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
  conversationId?: string;
  shareToken?: string;
}

export function ShareButton({ conversationId, shareToken }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  // Check if conversation is banned
  useEffect(() => {
    if (!conversationId) return;

    const checkBannedStatus = async () => {
      try {
        const response = await fetch(`/api/chat/conversation/${conversationId}/banned-status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsBanned(data.banned === true);
        }
      } catch (error) {
        // Silently fail - if we can't check, assume not banned
        console.error('Error checking banned status:', error);
      }
    };

    checkBannedStatus();
  }, [conversationId]);

  const handleShare = async () => {
    if (isSharing) return;

    setIsSharing(true);

    try {
      let token = shareToken;
      let shareUrl = '';

      // If we already have a share token, use it
      if (token) {
        shareUrl = `${window.location.origin}/app/shared/${token}`;
      } else if (conversationId) {
        // Otherwise, generate one via API
        const response = await fetch('/api/chat/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // If conversation is banned, don't show error - just return
          if (errorData.error?.includes('banned') || response.status === 403) {
            setIsBanned(true);
            return;
          }
          throw new Error('Failed to generate share link');
        }

        const data = await response.json();
        token = data.shareToken;
        shareUrl = `${window.location.origin}${data.shareUrl}`;
      } else {
        throw new Error('No conversation ID available');
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Error sharing conversation:', error);
      alert('Failed to generate share link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  // Don't render if no conversation ID or share token, or if banned
  if (!conversationId && !shareToken) {
    return null;
  }

  // Hide button if conversation is banned or if shareToken is explicitly null (banned conversations don't get tokens)
  if (isBanned || shareToken === null) {
    return null;
  }

  return (
    <button
      type="button"
      className="message-share-button"
      onClick={handleShare}
      disabled={isSharing}
      title={isCopied ? 'Link copied!' : 'Share conversation'}
      aria-label={isCopied ? 'Link copied!' : 'Share conversation'}
    >
      {isCopied ? (
        <>
          <span className="share-button-text">Copied</span>
          <Check size={16} />
        </>
      ) : (
        <>
          <span className="share-button-text">Share</span>
          <Share2 size={16} />
        </>
      )}
    </button>
  );
}

