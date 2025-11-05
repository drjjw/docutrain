/**
 * PDF Extractor
 * Handles PDF text extraction with automatic page markers using pdf.js-extract
 * Pure extraction logic (no database dependencies)
 */

const { PDFExtract } = require('pdf.js-extract');
const pdfExtract = new PDFExtract();
const { PDFExtractionError } = require('../errors/processing-errors');
const { validateBuffer } = require('../utils/input-validator');

/**
 * Clean PDF text to reduce noise
 */
function cleanPDFText(text) {
    let cleaned = text;

    // Convert "Page X" headers to citation markers
    cleaned = cleaned.replace(/\s*Page (\d+)\s*/g, '\n[Page $1]\n');

    // Convert standalone page numbers to citation markers
    cleaned = cleaned.replace(/^\s*(\d+)\s*$/gm, '\n[Page $1]\n');

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

    // Trim lines
    cleaned = cleaned.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    return cleaned;
}

/**
 * Enhanced PDF text extraction with automatic page markers using pdf.js-extract
 * This provides better text extraction and maintains proper reading order
 * 
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<{text: string, pages: number}>} Extracted text and page count
 * @throws {PDFExtractionError} If extraction fails
 */
async function extractPDFTextWithPageMarkers(buffer) {
    try {
        // Validate buffer
        validateBuffer(buffer, 'PDF buffer');
        
        // Extract PDF data with structure information
        const data = await pdfExtract.extractBuffer(buffer);
        
        if (!data || !data.pages || data.pages.length === 0) {
            throw new PDFExtractionError('PDF has no pages', { bufferSize: buffer.length });
        }
        
        const numPages = data.pages.length;
        let fullText = '';
        
        // Extract text page by page with markers
        data.pages.forEach((page, index) => {
            const pageNum = index + 1;
            
            // Add page marker
            if (pageNum === 1) {
                fullText += `[Page ${pageNum}]\n`;
            } else {
                fullText += `\n\n[Page ${pageNum}]\n`;
            }
            
            // Sort content by Y position (top to bottom) then X position (left to right)
            // This maintains proper reading order even in complex layouts
            const sortedContent = (page.content || []).sort((a, b) => {
                // If items are on roughly the same line (within 5 units), sort by X
                if (Math.abs(a.y - b.y) < 5) {
                    return a.x - b.x;
                }
                // Otherwise sort by Y (top to bottom)
                return a.y - b.y;
            });
            
            // Extract text with proper spacing
            let lastY = -1;
            let lineText = '';
            
            sortedContent.forEach((item) => {
                const text = (item.str || '').trim();
                if (!text) return;
                
                // Check if we're on a new line
                if (lastY !== -1 && Math.abs(item.y - lastY) > 5) {
                    // New line detected
                    if (lineText) {
                        fullText += lineText + '\n';
                        lineText = '';
                    }
                }
                
                // Add space between words on same line
                if (lineText && !lineText.endsWith(' ') && !text.startsWith(' ')) {
                    lineText += ' ';
                }
                
                lineText += text;
                lastY = item.y;
            });
            
            // Add any remaining line text
            if (lineText) {
                fullText += lineText;
            }
        });
        
        // Clean the extracted text
        fullText = cleanPDFText(fullText);
        
        // Validate extracted text
        if (!fullText || fullText.trim().length === 0) {
            throw new PDFExtractionError('PDF extraction produced no text', {
                pages: numPages,
                bufferSize: buffer.length
            });
        }
        
        return {
            text: fullText,
            pages: numPages,
            metadata: {
                extractionMethod: 'pdf.js-extract',
                totalCharacters: fullText.length,
                averageCharsPerPage: Math.floor(fullText.length / numPages)
            }
        };
        
    } catch (error) {
        // Re-throw PDFExtractionError as-is
        if (error instanceof PDFExtractionError) {
            throw error;
        }
        
        // Wrap other errors
        throw new PDFExtractionError(
            `PDF extraction failed: ${error.message}`,
            {
                originalError: error.message,
                bufferSize: buffer?.length || 0
            }
        );
    }
}

/**
 * Download PDF from Supabase Storage
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} filePath - Path to file in storage
 * @returns {Promise<Buffer>} PDF buffer
 * @throws {PDFExtractionError} If download fails
 */
async function downloadPDFFromStorage(supabase, filePath) {
    try {
        if (!filePath) {
            throw new PDFExtractionError('file_path is required', { filePath });
        }
        
        const { data, error } = await supabase.storage
            .from('user-documents')
            .download(filePath);
        
        if (error) {
            throw new PDFExtractionError(
                `Failed to download PDF: ${error.message}`,
                { filePath, error: error.message }
            );
        }
        
        if (!data) {
            throw new PDFExtractionError(
                'PDF download returned no data',
                { filePath }
            );
        }
        
        // Convert blob to buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Validate buffer
        validateBuffer(buffer, 'Downloaded PDF buffer');
        
        return buffer;
        
    } catch (error) {
        // Re-throw PDFExtractionError as-is
        if (error instanceof PDFExtractionError) {
            throw error;
        }
        
        // Wrap other errors
        throw new PDFExtractionError(
            `Failed to download PDF: ${error.message}`,
            { filePath, originalError: error.message }
        );
    }
}

module.exports = {
    extractPDFTextWithPageMarkers,
    cleanPDFText,
    downloadPDFFromStorage
};

