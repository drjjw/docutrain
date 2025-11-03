#!/usr/bin/env node

/**
 * Regenerate Abstracts for Maker Documents
 * 
 * This script regenerates AI-generated abstracts for all Maker Pizza documents
 * using their existing chunks. It does NOT reprocess the PDFs or regenerate chunks.
 * 
 * Usage: node scripts/regenerate-maker-abstracts.js [--dry-run] [--slug SLUG]
 * 
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --slug SLUG  Only process documents matching this slug
 */

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize OpenAI client
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✓ OpenAI client initialized\n');
} else {
    console.error('❌ ERROR: OPENAI_API_KEY not found in environment variables');
    process.exit(1);
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, operationName = 'OpenAI API call') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isRateLimit = error.status === 429;
            const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
            const isServerError = error.status >= 500 && error.status < 600;
            const isRetriable = isRateLimit || isTimeout || isServerError;
            
            if (attempt === maxRetries || !isRetriable) {
                console.error(`❌ ${operationName} failed after ${attempt} attempt(s):`, error.message);
                throw error;
            }
            
            let delay;
            if (isRateLimit && error.headers?.['retry-after']) {
                delay = parseInt(error.headers['retry-after']) * 1000;
            } else {
                delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            }
            
            console.warn(`⏳ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Generate a 100-word abstract from chunks using OpenAI
 */
async function generateAbstract(chunks, documentTitle) {
    console.log(`   🤖 Generating AI abstract for: ${documentTitle}`);
    console.log(`   📊 Total chunks available: ${chunks.length}`);
    
    try {
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
        
        console.log(`   📝 Using ${chunksForAbstract.length} chunks (${textForAbstract.length.toLocaleString()} characters)`);
        
        const abstract = await retryWithBackoff(async () => {
            const response = await openaiClient.chat.completions.create({
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
            
            return response.choices[0]?.message?.content?.trim() || null;
        }, 3, 'Abstract generation');
        
        if (abstract) {
            const wordCount = abstract.split(/\s+/).length;
            console.log(`   ✓ Generated abstract (${wordCount} words)`);
            return abstract;
        } else {
            console.log('   ⚠️  No abstract generated');
            return null;
        }
    } catch (error) {
        console.error('   ❌ Failed to generate abstract:', error.message);
        return null;
    }
}

/**
 * Fetch chunks for a document
 */
async function fetchChunks(documentSlug) {
    const { data, error } = await supabase
        .from('document_chunks')
        .select('content, chunk_index')
        .eq('document_slug', documentSlug)
        .order('chunk_index', { ascending: true });
    
    if (error) {
        console.error(`   ❌ Error fetching chunks: ${error.message}`);
        return null;
    }
    
    if (!data || data.length === 0) {
        console.warn(`   ⚠️  No chunks found for document`);
        return null;
    }
    
    return data.map(chunk => ({
        content: chunk.content,
        index: chunk.chunk_index
    }));
}

/**
 * Update document intro_message with new abstract
 */
async function updateDocumentIntro(documentSlug, abstract, dryRun = false) {
    if (dryRun) {
        console.log(`   [DRY RUN] Would update document intro_message with new abstract`);
        return true;
    }
    
    // Create intro message with abstract (matching format from document-processor.js)
    const introMessage = `<div class="document-abstract"><p><strong>Document Summary:</strong></p><p>${abstract}</p></div><p>Ask questions about this document below.</p>`;
    
    const { error: updateError } = await supabase
        .from('documents')
        .update({ 
            intro_message: introMessage,
            updated_at: new Date().toISOString()
        })
        .eq('slug', documentSlug);
    
    if (updateError) {
        console.error(`   ❌ Error updating document: ${updateError.message}`);
        return false;
    }
    
    console.log(`   ✓ Updated document intro_message`);
    return true;
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const slugArg = args.find(arg => arg.startsWith('--slug='));
    
    const slugFilter = slugArg ? slugArg.split('=')[1] : null;
    
    console.log('📝 Regenerate Abstracts for Maker Documents');
    console.log('='.repeat(60));
    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    if (slugFilter) {
        console.log(`🎯 Filtering by slug: ${slugFilter}\n`);
    }
    
    // Find all Maker documents (by owner slug)
    // First get the maker owner ID
    const { data: ownerData, error: ownerError } = await supabase
        .from('owners')
        .select('id')
        .eq('slug', 'maker')
        .single();
    
    if (ownerError || !ownerData) {
        console.error('❌ Error fetching maker owner:', ownerError?.message || 'Not found');
        process.exit(1);
    }
    
    let query = supabase
        .from('documents')
        .select('slug, title, intro_message')
        .eq('owner_id', ownerData.id)
        .order('created_at', { ascending: false });
    
    if (slugFilter) {
        query = query.eq('slug', slugFilter);
    }
    
    const { data: documents, error } = await query;
    
    if (error) {
        console.error('❌ Error fetching documents:', error.message);
        process.exit(1);
    }
    
    if (!documents || documents.length === 0) {
        console.log('✓ No Maker documents found');
        return;
    }
    
    console.log(`📋 Found ${documents.length} Maker document(s)\n`);
    
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        console.log(`\n[${i + 1}/${documents.length}] Processing: ${doc.slug}`);
        console.log(`   Title: ${doc.title}`);
        
        // Show current intro_message preview
        if (doc.intro_message) {
            const preview = doc.intro_message.substring(0, 100).replace(/\n/g, ' ');
            console.log(`   Current intro: ${preview}...`);
        } else {
            console.log(`   Current intro: (none)`);
        }
        
        // Fetch chunks
        const chunks = await fetchChunks(doc.slug);
        if (!chunks) {
            console.log(`   ⏭️  Skipping (no chunks found)`);
            skippedCount++;
            continue;
        }
        
        console.log(`   📚 Found ${chunks.length} chunks`);
        
        // Generate abstract with retry on failure
        let abstract = null;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (!abstract && retryCount <= maxRetries) {
            if (retryCount > 0) {
                console.log(`   🔄 Retrying abstract generation (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Progressive delay
            }
            
            abstract = await generateAbstract(chunks, doc.title);
            retryCount++;
        }
        
        if (!abstract) {
            console.log(`   ⏭️  Skipping (abstract generation failed after ${retryCount} attempts)`);
            skippedCount++;
            continue;
        }
        
        // Show new abstract preview
        const abstractPreview = abstract.substring(0, 100);
        console.log(`   📝 New abstract: ${abstractPreview}...`);
        
        // Update document
        const updated = await updateDocumentIntro(doc.slug, abstract, dryRun);
        if (updated) {
            successCount++;
        } else {
            failureCount++;
        }
        
        // Small delay to avoid rate limiting
        if (i < documents.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✓ Successfully processed: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📋 Total: ${documents.length}`);
    if (dryRun) {
        console.log('\n🔍 This was a dry run - no changes were made');
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

