#!/usr/bin/env node

/**
 * Bloomberg Sen Combined PDF Chunking and Embedding Script
 *
 * This script:
 * 1. Loads all Bloomberg Sen PDF documents from the bloombergsen folder
 * 2. Combines them into one chronological document (newest first)
 * 3. Splits into semantic chunks and generates embeddings using OpenAI
 * 4. Stores chunks and embeddings in Supabase as one document
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const CHUNK_SIZE = 500; // tokens (roughly 2000 characters)
const CHUNK_OVERLAP = 100; // tokens (roughly 400 characters)
const CHARS_PER_TOKEN = 4; // Rough estimate
const BATCH_SIZE = 50; // Process embeddings in batches
const BATCH_DELAY_MS = 100; // Small delay between batches

// Bloomberg Sen document configuration
const COMBINED_DOC_CONFIG = {
    slug: 'bloomberg-sen-combined',
    title: 'Bloomberg Sen Combined Financial Statements',
    pdf_subdirectory: 'bloombergsen',
    owner_id: '0db195fe-42b0-4a5d-be2e-20fa4316b94a' // Bloomberg Sen owner ID
};

// Document order (newest first for chronological context)
const DOCUMENT_ORDER = [
    { filename: '20250930_R.SWEINSTEIN.PDF', date: '2025-09-30', title: 'September 30, 2025 Statement' },
    { filename: '20250630_R.SWEINSTEIN.PDF', date: '2025-06-30', title: 'June 30, 2025 Statement' },
    { filename: '20250331_R.SWEINSTEIN.PDF', date: '2025-03-31', title: 'March 31, 2025 Statement' },
    { filename: '20241231_R.SWEINSTEIN.PDF', date: '2024-12-31', title: 'December 31, 2024 Statement' },
    { filename: '20240930_R.SWEINSTEIN.PDF', date: '2024-09-30', title: 'September 30, 2024 Statement' },
    { filename: 'Quarterly Statements_20240630_R.SWEINSTEIN.PDF', date: '2024-06-30', title: 'June 30, 2024 Quarterly Statements' },
    { filename: '20240331_R.JWEINSTE.PDF', date: '2024-03-31', title: 'March 31, 2024 Statement' }
];

/**
 * Clean PDF text to reduce noise
 */
function cleanPDFText(text) {
    let cleaned = text;

    // Convert "Page X" headers to citation markers
    cleaned = cleaned.replace(/\s*Page (\d+)\s*/g, '\n[Page $1]\n');

    // Convert standalone page numbers to citation markers
    cleaned = cleaned.replace(/^\s*(\d+)\s*$/gm, '\n[Page $1]\n');

    // Remove excessive whitespace but preserve paragraph structure
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Clean up common PDF artifacts
    cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, ''); // Remove non-printable chars except newlines/tabs

    return cleaned.trim();
}

/**
 * Extract text from PDF with page markers
 */
async function extractPDFTextWithPageMarkers(filepath) {
    const dataBuffer = fs.readFileSync(filepath);
    const data = await pdf(dataBuffer);

    let fullText = '';

    // pdf-parse gives us the full text, but we need to add page markers
    // Split by common page break patterns and reconstruct with markers
    let rawText = data.text;

    // Simple page detection - split by common page break patterns
    const pageBreaks = rawText.split(/\f|\n\s*\n\s*\n/);

    for (let pageNum = 1; pageNum <= Math.min(pageBreaks.length, data.numpages); pageNum++) {
        const pageText = pageBreaks[pageNum - 1] || '';
        const cleanedPageText = cleanPDFText(pageText);

        if (cleanedPageText.trim().length > 0) {
            // Add page marker
            fullText += `\n\n=== ${path.basename(filepath)} - Page ${pageNum} ===\n\n`;
            fullText += cleanedPageText;
            fullText += '\n\n';
        }
    }

    return cleanPDFText(fullText);
}

/**
 * Load and combine all Bloomberg Sen PDFs
 */
async function loadCombinedPDFs() {
    console.log('📖 Loading and combining Bloomberg Sen PDFs...');

    let combinedText = '';
    let totalPages = 0;

    // Process documents in chronological order (newest first)
    for (const doc of DOCUMENT_ORDER) {
        const filepath = path.join(__dirname, '..', 'PDFs', 'bloombergsen', doc.filename);

        if (!fs.existsSync(filepath)) {
            console.warn(`⚠️  PDF not found: ${filepath.filename}, skipping...`);
            continue;
        }

        console.log(`  📄 Loading ${doc.title} (${doc.date})...`);

        try {
            const pdfText = await extractPDFTextWithPageMarkers(filepath);
            const dataBuffer = fs.readFileSync(filepath);
            const data = await pdf(dataBuffer);

            // Add document separator with metadata
            combinedText += `\n\n${'='.repeat(80)}\n`;
            combinedText += `DOCUMENT: ${doc.title}\n`;
            combinedText += `DATE: ${doc.date}\n`;
            combinedText += `FILENAME: ${doc.filename}\n`;
            combinedText += `PAGES: ${data.numpages}\n`;
            combinedText += `${'='.repeat(80)}\n\n`;

            combinedText += pdfText;
            combinedText += '\n\n';

            totalPages += data.numpages;
            console.log(`    ✓ Added ${data.numpages} pages (${pdfText.length.toLocaleString()} chars)`);

        } catch (error) {
            console.error(`    ❌ Error loading ${doc.filename}:`, error.message);
            throw error;
        }
    }

    console.log(`\n✓ Combined ${DOCUMENT_ORDER.length} documents into one`);
    console.log(`✓ Total pages: ${totalPages}`);
    console.log(`✓ Total characters: ${combinedText.length.toLocaleString()}`);

    return {
        text: combinedText,
        pages: totalPages,
        documents: DOCUMENT_ORDER.length
    };
}

/**
 * Create semantic chunks with page awareness
 */
function chunkText(text, chunkSize, overlap, totalPages) {
    const chunks = [];
    const charsPerChunk = chunkSize * CHARS_PER_TOKEN;
    const charsPerOverlap = overlap * CHARS_PER_TOKEN;

    let charIndex = 0;
    let chunkIndex = 0;

    // Split text into paragraphs first to maintain document structure
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    let currentChunk = '';
    let currentCharStart = 0;
    let currentPageMarkers = [];

    for (const paragraph of paragraphs) {
        // Check if adding this paragraph would exceed chunk size
        if (currentChunk.length + paragraph.length > charsPerChunk && currentChunk.length > 0) {
            // Create chunk
            const chunk = {
                index: chunkIndex,
                content: currentChunk.trim(),
                charStart: currentCharStart,
                charEnd: currentCharStart + currentChunk.length,
                pageNumber: extractPageNumber(currentChunk),
                pageMarkersFound: currentPageMarkers.length
            };
            chunks.push(chunk);

            // Start new chunk with overlap
            const overlapText = currentChunk.slice(-charsPerOverlap);
            currentChunk = overlapText + '\n\n' + paragraph;
            currentCharStart = charIndex - charsPerOverlap;
            chunkIndex++;

            // Reset page markers for new chunk
            currentPageMarkers = extractPageMarkers(currentChunk);
        } else {
            // Add to current chunk
            if (currentChunk.length > 0) {
                currentChunk += '\n\n';
            }
            currentChunk += paragraph;
        }

        charIndex += paragraph.length + 2; // +2 for \n\n
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
        const chunk = {
            index: chunkIndex,
            content: currentChunk.trim(),
            charStart: currentCharStart,
            charEnd: currentCharStart + currentChunk.length,
            pageNumber: extractPageNumber(currentChunk),
            pageMarkersFound: currentPageMarkers.length
        };
        chunks.push(chunk);
    }

    return chunks;
}

/**
 * Extract page number from chunk content
 */
function extractPageNumber(content) {
    const pageMatch = content.match(/Page (\d+)/i);
    return pageMatch ? parseInt(pageMatch[1]) : null;
}

/**
 * Extract page markers from content
 */
function extractPageMarkers(content) {
    const markers = [];
    const pageRegex = /\[Page (\d+)\]/g;
    let match;
    while ((match = pageRegex.exec(content)) !== null) {
        markers.push(parseInt(match[1]));
    }
    return markers;
}

/**
 * Generate embeddings for chunks in batches
 */
async function generateEmbeddings(chunks) {
    const chunksWithEmbeddings = [];
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    console.log(`\n🔢 Generating embeddings for ${chunks.length} chunks...`);
    console.log(`   Processing in ${totalBatches} batches of ${BATCH_SIZE}`);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        console.log(`   Batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`);

        try {
            const texts = batch.map(chunk => chunk.content);
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: texts,
                encoding_format: 'float'
            });

            // Add embeddings to chunks
            batch.forEach((chunk, index) => {
                chunksWithEmbeddings.push({
                    chunk: chunk,
                    embedding: response.data[index].embedding
                });
            });

            console.log(`     ✓ Generated ${batch.length} embeddings`);

            // Small delay between batches
            if (i + BATCH_SIZE < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }

        } catch (error) {
            console.error(`\n❌ Error generating embeddings for batch ${batchNumber}:`, error.message);

            // Add null embeddings for failed batch
            batch.forEach(chunk => {
                chunksWithEmbeddings.push({
                    chunk: chunk,
                    embedding: null
                });
            });
        }
    }

    const successCount = chunksWithEmbeddings.filter(item => item.embedding !== null).length;
    console.log(`\n✓ Embedding generation complete: ${successCount}/${chunks.length} successful`);

    return chunksWithEmbeddings;
}

/**
 * Store chunks with embeddings in Supabase
 */
async function storeChunks(documentSlug, documentName, chunksWithEmbeddings) {
    const records = chunksWithEmbeddings
        .filter(item => item.embedding !== null)
        .map(({ chunk, embedding }) => ({
            document_type: documentSlug,
            document_slug: documentSlug,
            document_name: documentName,
            chunk_index: chunk.index,
            content: chunk.content,
            embedding: embedding,
            metadata: {
                char_start: chunk.charStart,
                char_end: chunk.charEnd,
                tokens_approx: Math.round(chunk.content.length / CHARS_PER_TOKEN),
                page_number: chunk.pageNumber,
                page_markers_found: chunk.pageMarkersFound,
                combined_document: true,
                source_documents: DOCUMENT_ORDER.map(d => d.filename)
            }
        }));

    console.log(`\n💾 Storing ${records.length} chunks in database...`);

    // Insert in batches to avoid payload size limits
    const insertBatchSize = 50;
    let inserted = 0;

    for (let i = 0; i < records.length; i += insertBatchSize) {
        const batch = records.slice(i, i + insertBatchSize);
        const { data, error } = await supabase
            .from('document_chunks')
            .insert(batch);

        if (error) {
            console.error(`\n❌ Error inserting batch ${i / insertBatchSize + 1}:`, error.message);
            throw error;
        }

        inserted += batch.length;
        process.stdout.write(`\r  💾 Inserted ${inserted}/${records.length} chunks`);
    }

    console.log('\n✓ All chunks stored successfully');
    return inserted;
}

/**
 * Main processing function
 */
async function main() {
    console.log('\n🚀 Bloomberg Sen Combined Document Processing');
    console.log('='.repeat(70));

    const startTime = Date.now();

    try {
        // Check if document already exists in registry
        const { data: existingDoc } = await supabase
            .from('documents')
            .select('slug')
            .eq('slug', COMBINED_DOC_CONFIG.slug)
            .single();

        if (!existingDoc) {
            // Create combined document in registry
            console.log('\n📝 Creating combined document in registry...');
            const { error: insertError } = await supabase
                .from('documents')
                .insert({
                    slug: COMBINED_DOC_CONFIG.slug,
                    title: COMBINED_DOC_CONFIG.title,
                    subtitle: 'All Statements Combined (Chronological)',
                    welcome_message: 'Bloomberg Sen Combined Financial Statements - All periods in chronological order',
                    pdf_filename: 'combined-bloomberg-sen.pdf', // Placeholder
                    pdf_subdirectory: COMBINED_DOC_CONFIG.pdf_subdirectory,
                    embedding_type: 'openai',
                    year: '2024-2025',
                    active: true,
                    owner_id: COMBINED_DOC_CONFIG.owner_id,
                    metadata: {
                        combined_document: true,
                        source_documents: DOCUMENT_ORDER.map(d => ({ filename: d.filename, date: d.date, title: d.title })),
                        total_documents: DOCUMENT_ORDER.length,
                        chronological_order: 'newest_first'
                    }
                });

            if (insertError) {
                throw new Error(`Failed to create document in registry: ${insertError.message}`);
            }
            console.log('✓ Combined document added to registry');
        } else {
            console.log('✓ Combined document already exists in registry');
        }

        // Delete existing chunks to allow re-processing
        console.log('\n🗑️  Deleting existing chunks...');
        const { error: deleteError } = await supabase
            .from('document_chunks')
            .delete()
            .eq('document_slug', COMBINED_DOC_CONFIG.slug);

        if (deleteError) {
            console.error('❌ Error deleting existing chunks:', deleteError.message);
            throw deleteError;
        }
        console.log('✓ Existing chunks deleted');

        // Load and combine all PDFs
        const combinedData = await loadCombinedPDFs();

        // Chunk the combined text
        console.log('\n✂️  Chunking combined text...');
        const chunks = chunkText(combinedData.text, CHUNK_SIZE, CHUNK_OVERLAP, combinedData.pages);
        console.log(`✓ Created ${chunks.length} chunks`);
        console.log(`✓ Average chunk size: ${(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length).toFixed(0)} chars`);

        // Generate embeddings
        const chunksWithEmbeddings = await generateEmbeddings(chunks);

        // Store in database
        const storedCount = await storeChunks(
            COMBINED_DOC_CONFIG.slug,
            COMBINED_DOC_CONFIG.title,
            chunksWithEmbeddings
        );

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n${'='.repeat(70)}`);
        console.log('✅ Bloomberg Sen Combined Processing Complete!');
        console.log(`   ⏱️  Total time: ${totalTime}s`);
        console.log(`   📄 Documents combined: ${DOCUMENT_ORDER.length}`);
        console.log(`   📄 Total pages: ${combinedData.pages}`);
        console.log(`   ✂️  Chunks created: ${chunks.length}`);
        console.log(`   🔢 Embeddings generated: ${storedCount}`);
        console.log(`${'='.repeat(70)}\n`);

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main };
