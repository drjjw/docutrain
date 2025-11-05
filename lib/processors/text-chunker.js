/**
 * Text Chunker
 * Pure function for splitting text into overlapping chunks with accurate page detection
 */

const { config } = require('../config/document-processing');
const { validateText, validatePageNumber } = require('../utils/input-validator');

/**
 * Split text into overlapping chunks with accurate page detection
 * Pure function - no side effects
 * 
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Chunk size in tokens (default from config)
 * @param {number} overlap - Overlap size in tokens (default from config)
 * @param {number} totalPages - Total number of pages (for validation)
 * @returns {Array<Object>} Array of chunk objects
 */
function chunkText(text, chunkSize = null, overlap = null, totalPages = 1) {
    // Use config defaults if not provided
    const effectiveChunkSize = chunkSize || config.chunking.size;
    const effectiveOverlap = overlap || config.chunking.overlap;
    const charsPerToken = config.chunking.charsPerToken;
    
    // Validate inputs
    validateText(text, 'text');
    if (totalPages !== null) {
        validatePageNumber(totalPages, null); // Validate but don't check upper bound
    }
    
    // Validate chunking parameters
    if (typeof effectiveChunkSize !== 'number' || effectiveChunkSize < 100 || effectiveChunkSize > 5000) {
        throw new Error(`chunkSize must be between 100 and 5000, got ${effectiveChunkSize}`);
    }
    
    if (typeof effectiveOverlap !== 'number' || effectiveOverlap < 0 || effectiveOverlap >= effectiveChunkSize) {
        throw new Error(`overlap must be between 0 and chunkSize (${effectiveChunkSize}), got ${effectiveOverlap}`);
    }
    
    const chunks = [];
    const chunkChars = effectiveChunkSize * charsPerToken;
    const overlapChars = effectiveOverlap * charsPerToken;

    // Find all page markers and their positions
    const pageMarkers = [];
    const pageMarkerRegex = /\[Page (\d+)\]/g;
    let match;
    while ((match = pageMarkerRegex.exec(text)) !== null) {
        const pageNum = parseInt(match[1], 10);
        const position = match.index;
        pageMarkers.push({ pageNum, position });
    }

    // Sort by position
    pageMarkers.sort((a, b) => a.position - b.position);

    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkChars, text.length);
        const chunk = text.substring(start, end);

        // Only include non-empty chunks
        if (chunk.trim().length > 0) {
            // Determine actual page number by finding the LAST page marker within this chunk
            // This is more accurate than using chunk center, especially for chunks spanning multiple pages
            let actualPage = 1; // Default to page 1
            
            // Find all page markers that fall within this chunk's range
            const markersInChunk = pageMarkers.filter(marker => 
                marker.position >= start && marker.position < end
            );
            
            if (markersInChunk.length > 0) {
                // Use the LAST page marker found in this chunk
                actualPage = markersInChunk[markersInChunk.length - 1].pageNum;
            } else {
                // No markers in this chunk - find the last marker BEFORE this chunk
                for (let i = pageMarkers.length - 1; i >= 0; i--) {
                    if (pageMarkers[i].position < start) {
                        actualPage = pageMarkers[i].pageNum;
                        break;
                    }
                }
            }

            // Ensure page number is within valid range
            actualPage = Math.min(Math.max(1, actualPage), totalPages || 999999);

            chunks.push({
                index: chunkIndex,
                content: chunk.trim(),
                charStart: start,
                charEnd: end,
                pageNumber: actualPage,
                pageMarkersFound: pageMarkers.length
            });
            chunkIndex++;
        }

        // Move forward by (chunkSize - overlap) to create overlap
        start += chunkChars - overlapChars;
    }

    // Validate that we created at least one chunk
    if (chunks.length === 0) {
        throw new Error('chunkText produced no chunks - text may be too short or empty after trimming');
    }

    return chunks;
}

module.exports = {
    chunkText
};

