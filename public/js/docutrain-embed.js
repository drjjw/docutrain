/**
 * DocuTrain Embed Script
 * Handles the chat modal functionality for embedded DocuTrain widgets
 */

(function() {
  'use strict';

  let docutrainIframeLoaded = false;
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
  window.openDocutrainChat = function() {
    const chatUrl = getChatUrl();
    if (!chatUrl) {
      console.error('DocuTrain: Chat URL not found. Make sure data-chat-url is set on the embed container.');
      return;
    }

    // On mobile: redirect to chat page
    if (isMobileDevice()) {
      window.location.href = chatUrl;
      return;
    }

    // On desktop: use modal
    const modal = document.getElementById('docutrain-chat-modal');
    const iframe = document.getElementById('docutrain-chat-iframe');
    const body = document.body;

    if (!modal || !iframe) {
      console.error('DocuTrain: Modal elements not found.');
      return;
    }

    // Set iframe src IMMEDIATELY to prevent flash of parent domain
    if (!docutrainIframeLoaded) {
      iframe.src = chatUrl;
      docutrainIframeLoaded = true;
    }

    // Show modal
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);

    body.classList.add('docutrain-modal-open');
    preventDocutrainScroll();
  };

  /**
   * Close the DocuTrain chat modal
   */
  window.closeDocutrainChat = function() {
    const modal = document.getElementById('docutrain-chat-modal');
    const body = document.body;

    if (!modal) return;

    modal.classList.remove('active');
    body.classList.remove('docutrain-modal-open');

    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);

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
    if (e.key === 'Escape') {
      const modal = document.getElementById('docutrain-chat-modal');
      if (modal && modal.classList.contains('active')) {
        closeDocutrainChat();
      }
    }
  });
})();

