import React, { useState, useMemo, useEffect } from 'react';
import type { DocumentEmbedCodeCardProps } from './types';

export function DocumentEmbedCodeCard({
  documentSlug,
  documentTitle
}: DocumentEmbedCodeCardProps) {
  const [buttonColor, setButtonColor] = useState('#3b82f6'); // Default blue
  const [buttonText, setButtonText] = useState('Chat with AI Assistant');
  const [showTitle, setShowTitle] = useState(false);
  const [titlePosition, setTitlePosition] = useState<'above' | 'below' | 'beside'>('above');
  const [customTitle, setCustomTitle] = useState(documentTitle || '');
  const [copied, setCopied] = useState(false);

  // Sync custom title when document title changes
  useEffect(() => {
    if (documentTitle && !customTitle) {
      setCustomTitle(documentTitle);
    }
  }, [documentTitle, customTitle]);

  // Get the base URL for the chat interface
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/app/chat`
    : 'https://your-domain.com/app/chat';

  // Generate the embed code
  const embedCode = useMemo(() => {
    const chatUrl = `${baseUrl}?doc=${encodeURIComponent(documentSlug)}`;
    const colorHex = buttonColor.replace('#', '');
    const rgbColor = hexToRgb(buttonColor);
    const displayTitle = customTitle || documentTitle || documentSlug;
    
    // Generate title HTML based on position
    const getTitleHtml = () => {
      if (!showTitle) return '';
      
      const titleStyle = titlePosition === 'beside' 
        ? 'display: inline-block; margin: 0; padding: 0; font-family: sans-serif; font-size: 18px; font-weight: 600; color: #1f2937; line-height: 1.4; vertical-align: middle;'
        : titlePosition === 'below'
        ? 'display: block; margin: 12px 0 0 0; padding: 0; font-family: sans-serif; font-size: 18px; font-weight: 600; color: #1f2937; line-height: 1.4; text-align: center;'
        : 'display: block; margin: 0 0 12px 0; padding: 0; font-family: sans-serif; font-size: 18px; font-weight: 600; color: #1f2937; line-height: 1.4; text-align: center;';
      
      return `<h3 class="docutrain-title" style="${titleStyle}">${displayTitle}</h3>`;
    };
    
    // Generate container HTML based on title position
    const containerStyle = titlePosition === 'beside'
      ? 'display: flex; align-items: center; flex-wrap: wrap; gap: 16px; font-family: sans-serif;'
      : 'display: block; font-family: sans-serif;';
    
    // Build the content based on position
    let contentHtml = '';
    if (titlePosition === 'above' && showTitle) {
      contentHtml = getTitleHtml() + '\n  ';
    }
    if (titlePosition === 'beside' && showTitle) {
      contentHtml = getTitleHtml() + '\n  ';
    }
    
    contentHtml += `<!-- CTA Button -->
  <button 
    id="docutrain-chat-button" 
    onclick="openDocutrainChat()"
    style="
      background-color: ${buttonColor};
      color: white;
      border: none;
      padding: 12px 24px;
      font-family: sans-serif;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      ${titlePosition === 'beside' ? 'flex-shrink: 0;' : titlePosition === 'above' || titlePosition === 'below' ? 'display: block; margin: 0 auto;' : ''}
    "
    onmouseover="this.style.opacity='0.9'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)';"
    onmouseout="this.style.opacity='1'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.1)';"
  >
    ${buttonText}
  </button>`;
    
    if (titlePosition === 'below' && showTitle) {
      contentHtml += '\n  ' + getTitleHtml();
    }
    
    return `<!-- DocuTrain Chat Embed Code -->
<!-- Generated for: ${documentTitle || documentSlug} -->
<!-- Document Slug: ${documentSlug} -->

<!-- Embed Container -->
<div class="docutrain-embed-container" style="${containerStyle}">
  ${contentHtml}
</div>

<!-- Chat Modal - Fullscreen -->
<div id="docutrain-chat-modal" class="docutrain-modal-overlay" style="display: none;">
  <div class="docutrain-modal-container">
    <button 
      class="docutrain-close-button" 
      type="button" 
      onclick="closeDocutrainChat()" 
      aria-label="Close chat"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <iframe 
      id="docutrain-chat-iframe"
      src=""
      class="docutrain-chat-iframe"
      allow="clipboard-write"
      title="Chat Assistant">
    </iframe>
  </div>
</div>

<!-- Styles -->
<style>
  .docutrain-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .docutrain-modal-overlay.active {
    opacity: 1;
    visibility: visible;
  }

  .docutrain-modal-container {
    position: relative;
    width: 100%;
    height: 100%;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.3s ease;
    font-family: sans-serif;
  }

  .docutrain-modal-overlay.active .docutrain-modal-container {
    opacity: 1;
  }

  .docutrain-chat-iframe {
    width: 100%;
    height: 100%;
    border: none;
    flex: 1;
    background: #ffffff !important;
    display: block;
    opacity: 0;
    transition: opacity 0.2s ease 0.3s;
    visibility: hidden;
  }

  .docutrain-modal-overlay.active .docutrain-chat-iframe {
    opacity: 1;
    visibility: visible;
  }

  .docutrain-close-button {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10000;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .docutrain-close-button:hover {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.1);
  }

  .docutrain-close-button svg {
    color: #333;
  }

  body.docutrain-modal-open {
    overflow: hidden;
    position: fixed;
    width: 100%;
  }

  .docutrain-embed-container {
    font-family: sans-serif;
  }

  .docutrain-title {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
</style>

<!-- JavaScript -->
<script>
  let docutrainIframeLoaded = false;
  let docutrainScrollPosition = 0;

  function openDocutrainChat() {
    // On mobile: redirect to chat page
    if (isMobileDevice()) {
      window.location.href = '${chatUrl}';
      return;
    }

    // On desktop: use modal
    const modal = document.getElementById('docutrain-chat-modal');
    const iframe = document.getElementById('docutrain-chat-iframe');
    const body = document.body;

    // Set iframe src IMMEDIATELY to prevent flash of parent domain
    if (!docutrainIframeLoaded) {
      iframe.src = '${chatUrl}';
      docutrainIframeLoaded = true;
    }

    // Show modal
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);

    body.classList.add('docutrain-modal-open');
    preventDocutrainScroll();
  }

  function closeDocutrainChat() {
    const modal = document.getElementById('docutrain-chat-modal');
    const body = document.body;

    modal.classList.remove('active');
    body.classList.remove('docutrain-modal-open');

    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);

    allowDocutrainScroll();
  }

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || (window.innerWidth <= 768);
  }

  function preventDocutrainScroll() {
    docutrainScrollPosition = window.pageYOffset;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + docutrainScrollPosition + 'px';
    document.body.style.width = '100%';
  }

  function allowDocutrainScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, docutrainScrollPosition);
  }

  // Close modal on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('docutrain-chat-modal');
      if (modal && modal.classList.contains('active')) {
        closeDocutrainChat();
      }
    }
  });
</script>`;
  }, [baseUrl, documentSlug, documentTitle, buttonColor, buttonText, showTitle, titlePosition, customTitle]);

  // Helper function to convert hex to RGB
  function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`
      : 'rgb(59, 130, 246)';
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = embedCode;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Embed Code</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-6">
        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Button Color
          </label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={buttonColor}
              onChange={(e) => setButtonColor(e.target.value)}
              className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                value={buttonColor}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    setButtonColor(value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="#3b82f6"
              />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Live Preview
          </label>
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div 
              className="docutrain-embed-container"
              style={{
                fontFamily: 'sans-serif',
                display: titlePosition === 'beside' ? 'flex' : 'block',
                alignItems: titlePosition === 'beside' ? 'center' : undefined,
                flexWrap: titlePosition === 'beside' ? 'wrap' : undefined,
                gap: titlePosition === 'beside' ? '16px' : undefined,
              }}
            >
              {showTitle && (titlePosition === 'above' || titlePosition === 'beside') && (
                <h3 
                  className="docutrain-title"
                  style={{
                    display: titlePosition === 'beside' ? 'inline-block' : 'block',
                    margin: titlePosition === 'beside' 
                      ? '0' 
                      : titlePosition === 'above' 
                        ? '0 0 12px 0' 
                        : '12px 0 0 0',
                    padding: 0,
                    fontFamily: 'sans-serif',
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#1f2937',
                    lineHeight: '1.4',
                    verticalAlign: titlePosition === 'beside' ? 'middle' : undefined,
                    textAlign: titlePosition === 'beside' ? 'left' : 'center',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {customTitle || documentTitle || documentSlug}
                </h3>
              )}
              <button
                style={{
                  backgroundColor: buttonColor,
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  fontFamily: 'sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  flexShrink: titlePosition === 'beside' ? 0 : undefined,
                  display: titlePosition === 'beside' ? 'inline-block' : 'block',
                  margin: titlePosition === 'beside' ? '0' : '0 auto',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }}
                disabled
              >
                {buttonText}
              </button>
              {showTitle && titlePosition === 'below' && (
                <h3 
                  className="docutrain-title"
                  style={{
                    display: 'block',
                    margin: '12px 0 0 0',
                    padding: 0,
                    fontFamily: 'sans-serif',
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#1f2937',
                    lineHeight: '1.4',
                    textAlign: 'center',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {customTitle || documentTitle || documentSlug}
                </h3>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            This is how your embed will appear on your website
          </p>
        </div>

        {/* Button Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CTA Button Text
          </label>
          <input
            type="text"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Chat with AI Assistant"
          />
          <p className="mt-1 text-xs text-gray-500">
            Customize the text displayed on the call-to-action button
          </p>
        </div>

        {/* Show Document Title */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              id="show-title"
              checked={showTitle}
              onChange={(e) => setShowTitle(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="show-title" className="text-sm font-medium text-gray-700 cursor-pointer">
              Show Document Title
            </label>
          </div>
          
          {showTitle && (
            <div className="ml-7 space-y-3">
              {/* Custom Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title Text
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={documentTitle || documentSlug || 'Document Title'}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use the document title from the database
                </p>
              </div>
              
              {/* Title Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title Position
                </label>
                <select
                  value={titlePosition}
                  onChange={(e) => setTitlePosition(e.target.value as 'above' | 'below' | 'beside')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="above">Above Button</option>
                  <option value="below">Below Button</option>
                  <option value="beside">Beside Button (Horizontal)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Choose where to display the title relative to the button
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Embed Code Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Embed Code
            </label>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Code
                </>
              )}
            </button>
          </div>
          <textarea
            readOnly
            value={embedCode}
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
          <p className="mt-2 text-xs text-gray-500">
            Copy and paste this code into your website to embed the chat interface. The button will open a fullscreen popup with the chat bot.
          </p>
        </div>
      </div>
    </div>
  );
}

