// UI Module - Barrel export for backward compatibility
// This file re-exports all public UI functions from modular sub-modules
// Maintains the exact same API surface as the original monolithic ui.js

// Export utilities (meta tags, colors, layout)
export { updateMetaTags, darkenColor, hexToRgba, equalizeContainerHeights } from './ui-utils.js';

// Export document UI management
export { updateDocumentUI } from './ui-document.js';

// Export message rendering and display
export { addMessage, updateModelInTooltip, buildResponseWithMetadata } from './ui-messages.js';

// Export loading indicators
export { addLoading, removeLoading } from './ui-loading.js';

// Export content styling (references, drug conversions)
export { styleReferences, wrapDrugConversionContent } from './ui-content-styling.js';

// Export downloads management
export { addDownloadsToWelcome } from './ui-downloads.js';

// Note: This modular structure maintains 100% backward compatibility
// Existing imports in main.js and chat.js will continue to work without changes
