/**
 * Backfill Keywords Utility Script
 * 
 * This script generates keywords for documents that were created before
 * the keyword generation feature was implemented.
 * 
 * Usage: node scripts/backfill-keywords.js [--dry-run] [--limit N] [--slug SLUG]
 * 
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --limit N    Only process first N documents (useful for testing)
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
 * Attempt to fix common JSON parsing issues
 */
function fixJSON(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        return jsonString;
    }
    
    let fixed = jsonString.trim();
    
    // Remove any markdown code blocks
    fixed = fixed.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // If response starts with explanation text, try to extract JSON
    const jsonMatch = fixed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        fixed = jsonMatch[0];
    }
    
    // Try to fix unterminated strings by closing them
    // Count quotes and try to balance them
    const quoteCount = (fixed.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
        // Find the last unclosed quote and try to close it
        const lastQuoteIndex = fixed.lastIndexOf('"');
        const afterLastQuote = fixed.substring(lastQuoteIndex + 1);
        // If there's content after the last quote that looks like it should be closed
        if (afterLastQuote.trim() && !afterLastQuote.includes('"')) {
            // Try to find where the term should end
            const commaIndex = afterLastQuote.indexOf(',');
            const bracketIndex = afterLastQuote.indexOf(']');
            const braceIndex = afterLastQuote.indexOf('}');
            const endIndex = Math.min(
                commaIndex >= 0 ? commaIndex : Infinity,
                bracketIndex >= 0 ? bracketIndex : Infinity,
                braceIndex >= 0 ? braceIndex : Infinity
            );
            if (endIndex !== Infinity) {
                fixed = fixed.substring(0, lastQuoteIndex + 1 + endIndex) + '"' + fixed.substring(lastQuoteIndex + 1 + endIndex);
            } else {
                // Just close it at the end
                fixed = fixed + '"';
            }
        }
    }
    
    // Try to fix truncated arrays/objects by closing them
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    
    // Close arrays first
    if (openBrackets > closeBrackets) {
        fixed = fixed + ']'.repeat(openBrackets - closeBrackets);
    }
    
    // Then close objects
    if (openBraces > closeBraces) {
        fixed = fixed + '}'.repeat(openBraces - closeBraces);
    }
    
    return fixed;
}

/**
 * Generate keywords for word cloud from chunks using OpenAI
 * Returns an array of keyword objects with term and weight
 */
async function generateKeywords(openaiClient, chunks, documentTitle) {
    console.log(`   📝 Generating keywords for: ${documentTitle}`);
    console.log(`   📊 Total chunks available: ${chunks.length}`);
    
    try {
        // Take the first 30 chunks (or all if less than 30) to get a good overview
        const chunksForKeywords = chunks.slice(0, Math.min(30, chunks.length));
        
        // Combine chunk content
        const combinedText = chunksForKeywords
            .map(chunk => chunk.content)
            .join('\n\n');
        
        // Truncate if too long (to stay within token limits)
        const maxChars = 20000; // ~5000 tokens
        const textForKeywords = combinedText.length > maxChars 
            ? combinedText.substring(0, maxChars) + '...'
            : combinedText;
        
        const content = await retryWithBackoff(async () => {
            const response = await openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at analyzing document content and extracting key terms and concepts. Identify the most important keywords, phrases, and concepts that would be useful for a word cloud visualization. Focus on domain-specific terms, key concepts, and important topics. Always respond with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: `Analyze the following document content and extract 20-30 key terms, phrases, and concepts that best represent this document. For each term, assign a weight from 0.1 to 1.0 based on its importance (1.0 = most important, 0.1 = less important but still relevant).\n\nDocument title: "${documentTitle}"\n\nContent:\n${textForKeywords}\n\nReturn your response as a JSON object with a "keywords" property containing an array of objects, each with "term" (string) and "weight" (number) properties. Example format:\n{"keywords": [{"term": "kidney disease", "weight": 0.95}, {"term": "chronic kidney disease", "weight": 0.90}, {"term": "treatment", "weight": 0.75}]}\n\nProvide ONLY the JSON object, no additional commentary.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 800, // Increased to avoid truncation
                response_format: { type: "json_object" }
            }, {
                timeout: 30000 // 30 second timeout (as options parameter)
            });
            
            return response.choices[0]?.message?.content?.trim();
        }, 3, 'Keyword generation');
        
        if (!content) {
            console.error('   ❌ No content in OpenAI response for keywords');
            return null;
        }
        
        // Parse JSON response - GPT may wrap it in an object
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (parseError) {
            // Try to fix common JSON issues
            console.warn(`   ⚠️  Initial JSON parse failed, attempting to fix...`);
            const fixedContent = fixJSON(content);
            try {
                parsed = JSON.parse(fixedContent);
                console.log(`   ✓ Successfully fixed and parsed JSON`);
            } catch (fixError) {
                console.error('   ❌ Failed to parse keywords JSON even after fix attempt:', parseError.message);
                console.error('   📝 Raw content preview:', content.substring(0, 200) + '...');
                return null;
            }
        }
        
        // Handle both direct array and wrapped object responses
        let keywords = null;
        if (Array.isArray(parsed)) {
            keywords = parsed;
        } else if (parsed.keywords && Array.isArray(parsed.keywords)) {
            keywords = parsed.keywords;
        } else if (parsed.terms && Array.isArray(parsed.terms)) {
            keywords = parsed.terms;
        } else {
            // Try to find any array in the response
            const keys = Object.keys(parsed);
            for (const key of keys) {
                if (Array.isArray(parsed[key])) {
                    keywords = parsed[key];
                    break;
                }
            }
        }
        
        if (!keywords || !Array.isArray(keywords)) {
            console.error('   ❌ Keywords not found in expected format. Parsed response:', JSON.stringify(parsed, null, 2));
            return null;
        }
        
        // Validate and clean keywords
        const validKeywords = keywords
            .filter(k => k && typeof k === 'object' && k.term && typeof k.term === 'string')
            .map(k => ({
                term: k.term.trim(),
                weight: typeof k.weight === 'number' ? Math.max(0.1, Math.min(1.0, k.weight)) : 0.5
            }))
            .filter(k => k.term.length > 0)
            .slice(0, 30); // Limit to 30 keywords
        
        if (validKeywords.length === 0) {
            console.error('   ❌ No valid keywords after filtering. Original keywords array length:', keywords.length);
            return null;
        }
        
        console.log(`   ✓ Generated ${validKeywords.length} keywords`);
        return validKeywords;
        
    } catch (error) {
        console.error('   ❌ Failed to generate keywords:', error.message);
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
 * Update document metadata with keywords
 */
async function updateDocumentKeywords(documentSlug, keywords, dryRun = false) {
    if (dryRun) {
        console.log(`   [DRY RUN] Would update document with ${keywords.length} keywords`);
        return true;
    }
    
    // Get current metadata
    const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('metadata')
        .eq('slug', documentSlug)
        .single();
    
    if (fetchError) {
        console.error(`   ❌ Error fetching document: ${fetchError.message}`);
        return false;
    }
    
    // Update metadata with keywords
    const updatedMetadata = {
        ...doc.metadata,
        keywords: keywords
    };
    
    const { error: updateError } = await supabase
        .from('documents')
        .update({ metadata: updatedMetadata })
        .eq('slug', documentSlug);
    
    if (updateError) {
        console.error(`   ❌ Error updating document: ${updateError.message}`);
        return false;
    }
    
    console.log(`   ✓ Updated document metadata with keywords`);
    return true;
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const slugArg = args.find(arg => arg.startsWith('--slug='));
    
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
    const slugFilter = slugArg ? slugArg.split('=')[1] : null;
    
    console.log('🔑 Keyword Backfill Utility');
    console.log('=' .repeat(50));
    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    if (limit) {
        console.log(`📊 Processing limit: ${limit} documents\n`);
    }
    if (slugFilter) {
        console.log(`🎯 Filtering by slug: ${slugFilter}\n`);
    }
    
    // Find documents without keywords
    let query = supabase
        .from('documents')
        .select('slug, title, metadata')
        .or('metadata->>keywords.is.null,metadata->>keywords.eq.null,metadata->>keywords.eq.[]')
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
        console.log('✓ No documents found without keywords');
        return;
    }
    
    console.log(`📋 Found ${documents.length} documents without keywords\n`);
    
    const documentsToProcess = limit ? documents.slice(0, limit) : documents;
    
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < documentsToProcess.length; i++) {
        const doc = documentsToProcess[i];
        console.log(`\n[${i + 1}/${documentsToProcess.length}] Processing: ${doc.slug}`);
        console.log(`   Title: ${doc.title}`);
        
        // Fetch chunks
        const chunks = await fetchChunks(doc.slug);
        if (!chunks) {
            console.log(`   ⏭️  Skipping (no chunks found)`);
            skippedCount++;
            continue;
        }
        
        // Generate keywords with retry on failure
        let keywords = null;
        let retryCount = 0;
        const maxKeywordRetries = 2;
        
        while (!keywords && retryCount <= maxKeywordRetries) {
            if (retryCount > 0) {
                console.log(`   🔄 Retrying keyword generation (attempt ${retryCount + 1}/${maxKeywordRetries + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Progressive delay
            }
            
            keywords = await generateKeywords(openaiClient, chunks, doc.title);
            retryCount++;
        }
        
        if (!keywords || keywords.length === 0) {
            console.log(`   ⏭️  Skipping (keyword generation failed after ${retryCount} attempts)`);
            skippedCount++;
            continue;
        }
        
        // Update document
        const updated = await updateDocumentKeywords(doc.slug, keywords, dryRun);
        if (updated) {
            successCount++;
        } else {
            failureCount++;
        }
        
        // Small delay to avoid rate limiting
        if (i < documentsToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   ✓ Successfully processed: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📋 Total: ${documentsToProcess.length}`);
    if (dryRun) {
        console.log('\n🔍 This was a dry run - no changes were made');
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

