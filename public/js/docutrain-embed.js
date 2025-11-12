/**
 * DocuTrain Embed Script
 * Handles the chat modal functionality for embedded DocuTrain widgets
 * Modern modal implementation matching ukidney-guidelines.html
 */

(function() {
  'use strict';

  let docutrainChatModalOpen = false;
  let isOpeningDocutrainModal = false; // Guard to prevent multiple simultaneous calls
  let docutrainScrollPosition = 0;

  /**
   * Get the chat URL from the embed container's data attribute
   */
  function getChatUrl() {
    const container = document.querySelector('.docutrain-embed-container');
    return container ? container.getAttribute('data-chat-url') : null;
  }

  /**
   * Open the DocuTrain chat modal
   */
  window.openDocutrainChat = function(event) {
    const chatUrl = getChatUrl();
    if (!chatUrl) {
      console.error('DocuTrain: Chat URL not found. Make sure data-chat-url is set on the embed container.');
      return false;
    }

    // Prevent multiple simultaneous calls
    if (isOpeningDocutrainModal || docutrainChatModalOpen) {
      console.log('DocuTrain: Modal already opening or open, ignoring duplicate call');
      return false;
    }

    // Prevent any default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    // Also prevent window navigation
    if (window.event) {
      window.event.preventDefault();
      window.event.stopPropagation();
    }

    // On mobile: redirect to chat page
    if (isMobileDevice()) {
      window.location.href = chatUrl;
      return false;
    }

    // On desktop: use modal
    const modal = document.getElementById('docutrain-chat-modal');
    const iframe = document.getElementById('docutrain-chat-iframe');
    const body = document.body;

    if (!modal || !iframe) {
      console.error('DocuTrain: Modal elements not found.');
      return false;
    }

    isOpeningDocutrainModal = true;

    console.log('DocuTrain: Opening modal');

    // Show modal IMMEDIATELY - don't wait for iframe
    modal.style.display = 'block';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '99999'; // Ensure it's on top
    body.classList.add('docutrain-modal-open');
    docutrainChatModalOpen = true;
    preventDocutrainScroll();

    // Force modal to be visible immediately
    requestAnimationFrame(function() {
      modal.classList.add('active');
      // Double-check modal is visible
      if (modal.style.display !== 'block') {
        modal.style.display = 'block';
      }
      if (!modal.classList.contains('active')) {
        modal.classList.add('active');
      }
    });

    // Set iframe src AFTER modal is visible
    iframe.src = 'about:blank';

    // Use a tiny delay to ensure about:blank is set, then set the actual URL
    setTimeout(function() {
      iframe.src = chatUrl;
      isOpeningDocutrainModal = false; // Reset guard after modal is shown

      // Verify modal is actually visible
      setTimeout(function() {
        const computedStyle = window.getComputedStyle(modal);
        console.log('DocuTrain: Modal visibility check:', {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          zIndex: computedStyle.zIndex,
          hasActiveClass: modal.classList.contains('active')
        });

        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
          console.warn('DocuTrain: Modal not visible! Forcing visibility...');
          modal.style.display = 'block';
          modal.style.visibility = 'visible';
          modal.style.opacity = '1';
          modal.classList.add('active');
        }
      }, 100);
    }, 10);

    return false;
  };

  /**
   * Close the DocuTrain chat modal
   */
  window.closeDocutrainChat = function() {
    const modal = document.getElementById('docutrain-chat-modal');
    const iframe = document.getElementById('docutrain-chat-iframe');
    const body = document.body;

    if (!modal) return;

    modal.classList.remove('active');
    body.classList.remove('docutrain-modal-open');
    docutrainChatModalOpen = false;

    // Reset iframe and hide modal after transition completes
    setTimeout(function() {
      if (iframe) {
        iframe.src = 'about:blank';
      }
      modal.style.display = 'none'; // Hide after transition
    }, 400);

    allowDocutrainScroll();
  };

  /**
   * Check if device is mobile
   */
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || (window.innerWidth <= 768);
  }

  /**
   * Prevent body scroll when modal is open
   */
  function preventDocutrainScroll() {
    docutrainScrollPosition = window.pageYOffset;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + docutrainScrollPosition + 'px';
    document.body.style.width = '100%';
  }

  /**
   * Restore body scroll when modal is closed
   */
  function allowDocutrainScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, docutrainScrollPosition);
  }

  /**
   * Close modal on Escape key
   */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && docutrainChatModalOpen) {
      window.closeDocutrainChat();
    }
  });

  // Prevent closing when clicking inside the panel
  document.addEventListener('DOMContentLoaded', function() {
    const modalContainer = document.querySelector('.docutrain-modal-container');
    if (modalContainer) {
      modalContainer.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    // Handle backdrop click to close
    const backdrop = document.querySelector('.docutrain-modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function() {
        window.closeDocutrainChat();
      });
    }
  });
})();

