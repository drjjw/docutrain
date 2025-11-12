import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@/components/UI/Tabs';
import type { DocumentEmbedCodeCardProps } from './types';

export function DocumentEmbedCodeCard({
  documentSlug,
  documentTitle
}: DocumentEmbedCodeCardProps) {
  const [buttonColor, setButtonColor] = useState('#3b82f6'); // Default blue
  const [buttonColorInput, setButtonColorInput] = useState('#3b82f6'); // For manual input
  const [buttonText, setButtonText] = useState('Chat with AI Assistant');
  const [showTitle, setShowTitle] = useState(false);
  const [titlePosition, setTitlePosition] = useState<'above' | 'below' | 'beside'>('above');
  const [customTitle, setCustomTitle] = useState(documentTitle || '');
  const [copied, setCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const qrCodeRef = useRef<SVGSVGElement>(null);

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

  // Generate the share URL for QR code
  const shareUrl = useMemo(() => {
    return `https://www.docutrain.io/app/chat?doc=${encodeURIComponent(documentSlug)}`;
  }, [documentSlug]);

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
    onclick="openDocutrainChat(event)"
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
    
    // Get the base URL for assets (CSS/JS files)
    const assetsBaseUrl = typeof window !== 'undefined' 
      ? window.location.origin
      : 'https://your-domain.com';
    
    return `<!-- DocuTrain Chat Embed Code -->
<!-- Generated for: ${documentTitle || documentSlug} -->
<!-- Document Slug: ${documentSlug} -->

<!-- External Stylesheet -->
<link rel="stylesheet" href="${assetsBaseUrl}/css/docutrain-embed.css">

<!-- Embed Container -->
<div class="docutrain-embed-container" style="${containerStyle}" data-chat-url="${chatUrl}">
  ${contentHtml}
</div>

<!-- Chat Modal - Fullscreen -->
<div id="docutrain-chat-modal" class="docutrain-modal-overlay">
  <div class="docutrain-modal-backdrop" onclick="closeDocutrainChat()"></div>
  <div class="docutrain-modal-container">
    <button 
      class="docutrain-close-button" 
      type="button" 
      onclick="closeDocutrainChat()" 
      aria-label="Close chat"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div class="docutrain-modal-body">
      <iframe 
        id="docutrain-chat-iframe"
        src="about:blank"
        class="docutrain-chat-iframe"
        allow="clipboard-write"
        title="Chat Assistant">
      </iframe>
    </div>
  </div>
</div>

<!-- External JavaScript -->
<script src="${assetsBaseUrl}/js/docutrain-embed.js"></script>`;
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

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleDownloadQRCode = () => {
    if (!qrCodeRef.current) return;

    // Get the SVG element
    const svgElement = qrCodeRef.current;
    
    // Serialize the SVG to a string
    const svgData = new XMLSerializer().serializeToString(svgElement);
    
    // Create a blob with the SVG data
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(svgBlob);
    
    // Generate filename: docutrain-document-name.svg
    const documentName = (documentTitle || documentSlug || 'document')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    const filename = `docutrain-${documentName}.svg`;
    
    // Create a temporary anchor element and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Share & Embed</h4>
        </div>
      </div>
      <div className="px-6 py-4">
        <Tabs defaultIndex={0}>
          <TabList>
            <Tab index={0}>QR Code</Tab>
            <Tab index={1}>Embed Code</Tab>
          </TabList>
          <TabPanels>
            {/* QR Code Tab */}
            <TabPanel>
              <div className="space-y-6 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Share Link
                  </label>
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div className="flex-shrink-0">
                      <div className="p-4 bg-white rounded-lg border-2 border-gray-200 inline-block">
                        <QRCodeSVG
                          ref={qrCodeRef}
                          value={shareUrl}
                          size={160}
                          level="M"
                          includeMargin={true}
                        />
                      </div>
                      <button
                        onClick={handleDownloadQRCode}
                        className="mt-3 w-full px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors flex items-center justify-center gap-2 border border-indigo-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download QR Code
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Share URL
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={shareUrl}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                              onClick={handleCopyShareUrl}
                              className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                              {qrCopied ? (
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
                                  Copy URL
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          Scan the QR code or copy the link to share this document chat. The QR code automatically updates when the document slug changes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            {/* Embed Code Tab */}
            <TabPanel>
              <div className="space-y-6 pt-4">
                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Button Color
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={buttonColor}
                      onChange={(e) => {
                        const newColor = e.target.value;
                        setButtonColor(newColor);
                        setButtonColorInput(newColor);
                      }}
                      className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={buttonColorInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setButtonColorInput(value);
                          // Validate hex color format (allows partial input while typing)
                          if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                            // If it's a complete 6-digit hex, update the actual color
                            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                              setButtonColor(value);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          // Validate and normalize on blur
                          if (/^#[0-9A-Fa-f]{6}$/i.test(value)) {
                            // Normalize to uppercase
                            const normalized = value.toUpperCase();
                            setButtonColor(normalized);
                            setButtonColorInput(normalized);
                          } else if (/^[0-9A-Fa-f]{6}$/i.test(value)) {
                            // If missing #, add it
                            const normalized = `#${value.toUpperCase()}`;
                            setButtonColor(normalized);
                            setButtonColorInput(normalized);
                          } else if (/^#[0-9A-Fa-f]{3}$/i.test(value)) {
                            // Expand 3-digit hex to 6-digit
                            const expanded = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toUpperCase();
                            setButtonColor(expanded);
                            setButtonColorInput(expanded);
                          } else {
                            // Invalid format, revert to last valid color
                            setButtonColorInput(buttonColor);
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono ${
                          /^#[0-9A-Fa-f]{6}$/i.test(buttonColorInput) 
                            ? 'border-gray-300' 
                            : 'border-red-300 bg-red-50'
                        }`}
                        placeholder="#3b82f6"
                      />
                      {!/^#[0-9A-Fa-f]{6}$/i.test(buttonColorInput) && buttonColorInput !== buttonColor && (
                        <p className="mt-1 text-xs text-red-600">
                          Enter a valid hex color (e.g., #3b82f6 or #FF5733)
                        </p>
                      )}
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
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
}

