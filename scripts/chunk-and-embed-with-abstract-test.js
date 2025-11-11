#!/usr/bin/env node

/**
 * PDF Chunking with AI Abstract Generation (TEST VERSION)
 * 
 * This script:
 * 1. Loads a specific PDF document
 * 2. Splits it into semantic chunks (500 tokens with 100 token overlap)
 * 3. Uses OpenAI to generate a 100-word abstract from the chunks
 * 4. DOES NOT store anything in the database (test mode)
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const CHUNK_SIZE = 500; // tokens (roughly 2000 characters)
const CHUNK_OVERLAP = 100; // tokens (roughly 400 characters)
const CHARS_PER_TOKEN = 4; // Rough estimate

/**
 * Clean PDF text to reduce noise
 */
function cleanPDFText(text) {
    let cleaned = text;

    // Convert "Page X" headers to citation markers
    cleaned = cleaned.replace(/\s*Page (\d+)\s*/g, '\n[Page $1]\n');

    // Convert standalone page numbers
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
 * Enhanced PDF text extraction with automatic page markers
 */
async function extractPDFTextWithPageMarkers(pdfPath) {
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdf(buffer);

    let fullText = data.text;
    const numPages = data.numpages;

    // Check if text already has page markers
    const pageMarkerRegex = /\[Page \d+\]/g;
    const existingMarkers = fullText.match(pageMarkerRegex);

    if (!existingMarkers || existingMarkers.length < numPages * 0.5) {
        console.log(`   Adding ${numPages} page markers to text...`);

        // Clean the text first
        fullText = cleanPDFText(fullText);

        // Calculate approximate characters per page
        const totalChars = fullText.length;
        const avgCharsPerPage = Math.floor(totalChars / numPages);

        // Insert page markers at estimated boundaries
        let markedText = '';
        let currentPos = 0;
        let currentPage = 1;

        // Add first page marker
        markedText += `[Page ${currentPage}]\n`;

        while (currentPos < totalChars && currentPage <= numPages) {
            const pageEnd = Math.min(currentPos + avgCharsPerPage, totalChars);
            const pageText = fullText.substring(currentPos, pageEnd);

            markedText += pageText;

            currentPos = pageEnd;
            currentPage++;

            if (currentPage <= numPages && currentPos < totalChars) {
                markedText += `\n\n[Page ${currentPage}]\n`;
            }
        }

        fullText = markedText;
    }

    return fullText;
}

/**
 * Split text into overlapping chunks with accurate page detection
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP, totalPages = 1) {
    const chunks = [];
    const chunkChars = chunkSize * CHARS_PER_TOKEN;
    const overlapChars = overlap * CHARS_PER_TOKEN;

    // Find all page markers and their positions
    const pageMarkers = [];
    const pageMarkerRegex = /\[Page (\d+)\]/g;
    let match;
    while ((match = pageMarkerRegex.exec(text)) !== null) {
        const pageNum = parseInt(match[1]);
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
            actualPage = Math.min(Math.max(1, actualPage), totalPages);

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

    return chunks;
}

/**
 * Load PDF and return content
 */
async function loadPDF(filepath) {
    const text = await extractPDFTextWithPageMarkers(filepath);
    const dataBuffer = fs.readFileSync(filepath);
    const data = await pdf(dataBuffer);

    return {
        text: text,
        pages: data.numpages,
        info: data.info
    };
}

/**
 * Generate a 100-word abstract from chunks using OpenAI
 */
async function generateAbstract(chunks, documentTitle) {
    console.log('\n🤖 Generating AI abstract from chunks...');
    
    // Take the first 30 chunks (or all if less than 30) to get a good overview
    const chunksForAbstract = chunks.slice(0, Math.min(30, chunks.length));
    
    // Combine chunk content
    const combinedText = chunksForAbstract
        .map(chunk => chunk.content)
        .join('\n\n');
    
    // Truncate if too long (to stay within token limits)
    const maxChars = 20000; // ~5000 tokens
    const textForAbstract = combinedText.length > maxChars 
        ? combinedText.substring(0, maxChars) + '...'
        : combinedText;
    
    console.log(`   Using ${chunksForAbstract.length} chunks (${textForAbstract.length.toLocaleString()} characters)`);
    
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at creating concise, informative abstracts from document content. Create a 100-word abstract that captures the key themes, purpose, and scope of the document.'
                },
                {
                    role: 'user',
                    content: `Please create a 100-word abstract for a document titled "${documentTitle}". Base your abstract on the following content from the document:\n\n${textForAbstract}\n\nProvide ONLY the abstract text, no additional commentary. The abstract should be exactly 100 words.`
                }
            ],
            temperature: 0.7,
            max_tokens: 200
        });
        
        const abstract = response.usage.completion_tokens > 0 
            ? response.choices[0].message.content.trim()
            : null;
        
        if (abstract) {
            const wordCount = abstract.split(/\s+/).length;
            console.log(`   ✓ Generated abstract (${wordCount} words)`);
            return abstract;
        } else {
            console.log('   ⚠️  No abstract generated');
            return null;
        }
    } catch (error) {
        console.error('   ❌ Error generating abstract:', error.message);
        return null;
    }
}

/**
 * Main processing function
 */
async function processDocumentTest(pdfPath) {
    const filename = path.basename(pdfPath);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📄 TEST MODE: Processing ${filename}`);
    console.log(`   Path: ${pdfPath}`);
    console.log(`${'='.repeat(80)}\n`);

    const startTime = Date.now();
    
    // 1. Load PDF
    console.log('📖 Loading PDF...');
    const pdfData = await loadPDF(pdfPath);
    console.log(`  ✓ Loaded ${pdfData.pages} pages`);
    console.log(`  ✓ Total characters: ${pdfData.text.length.toLocaleString()}`);
    
    // 2. Chunk text
    console.log('\n✂️  Chunking text...');
    const chunks = chunkText(pdfData.text, CHUNK_SIZE, CHUNK_OVERLAP, pdfData.pages);
    console.log(`  ✓ Created ${chunks.length} chunks`);
    console.log(`  ✓ Chunk size: ~${CHUNK_SIZE} tokens (${CHUNK_SIZE * CHARS_PER_TOKEN} chars)`);
    console.log(`  ✓ Overlap: ~${CHUNK_OVERLAP} tokens (${CHUNK_OVERLAP * CHARS_PER_TOKEN} chars)`);
    
    // Show sample of first chunk
    console.log('\n📝 Sample of first chunk:');
    console.log('   ' + '-'.repeat(76));
    const firstChunkPreview = chunks[0].content.substring(0, 300) + '...';
    console.log('   ' + firstChunkPreview.replace(/\n/g, '\n   '));
    console.log('   ' + '-'.repeat(76));
    
    // 3. Generate abstract
    const abstract = await generateAbstract(chunks, filename);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));
    console.log(`\n📄 Document: ${filename}`);
    console.log(`📑 Pages: ${pdfData.pages}`);
    console.log(`✂️  Chunks: ${chunks.length}`);
    console.log(`⏱️  Processing time: ${duration}s`);
    
    if (abstract) {
        console.log('\n' + '─'.repeat(80));
        console.log('📝 GENERATED ABSTRACT:');
        console.log('─'.repeat(80));
        console.log(abstract);
        console.log('─'.repeat(80));
        
        // Word count
        const wordCount = abstract.split(/\s+/).length;
        console.log(`\n📊 Abstract stats: ${wordCount} words`);
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('💡 NOTE: No data was stored in the database (test mode)');
    console.log('='.repeat(80) + '\n');
}

/**
 * Main execution
 */
async function main() {
    console.log('\n🚀 PDF Chunking & Abstract Generation (TEST MODE)');
    console.log('=' .repeat(80));
    
    // Check environment
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_key_here') {
        console.error('❌ OPENAI_API_KEY not found in environment');
        console.error('   Please add your OpenAI API key to .env file');
        process.exit(1);
    }
    
    console.log('✓ Environment variables loaded');
    console.log('✓ Using OpenAI GPT-4o-mini for abstract generation');
    
    // Get PDF path from command line
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('\n❌ Error: No PDF path provided');
        console.log('\nUsage:');
        console.log('  node chunk-and-embed-with-abstract-test.js <path-to-pdf>');
        console.log('\nExample:');
        console.log('  node chunk-and-embed-with-abstract-test.js "/Users/jordanweinstein/GitHub/docutrain/PDFs/guidelines/KPD - Protocol for Participating Donors 2019_61 012 v4.pdf"');
        process.exit(1);
    }
    
    const pdfPath = args[0];
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
        console.error(`\n❌ Error: File not found: ${pdfPath}`);
        process.exit(1);
    }
    
    // Check if it's a PDF
    if (!pdfPath.toLowerCase().endsWith('.pdf')) {
        console.error(`\n❌ Error: File must be a PDF: ${pdfPath}`);
        process.exit(1);
    }
    
    // Process the document
    await processDocumentTest(pdfPath);
}

// Run main function
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { processDocumentTest, generateAbstract };

