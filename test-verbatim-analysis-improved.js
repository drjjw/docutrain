/**
 * Improved verbatim analysis - more accurate calculation
 * Issues with original:
 * 1. Only finds longest match, not total verbatim content
 * 2. Divides by max(length) instead of response length
 * 3. Doesn't account for multiple verbatim phrases
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test with one query to demonstrate improved analysis
const testQuery = {
    question: "How do you screen for chronic kidney disease in patients with diabetes?",
    doc: "dc"
};

async function getChunkContent(documentSlug, chunkIndex) {
    const { data, error } = await supabase
        .from('document_chunks')
        .select('content, chunk_index, metadata')
        .eq('document_slug', documentSlug)
        .eq('chunk_index', chunkIndex)
        .single();
    
    if (error) return null;
    return data;
}

async function makeChatQuery(query, doc) {
    const fetchFn = require('node-fetch');
    const response = await fetchFn('http://localhost:3458/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, doc: doc, model: 'gemini', history: [] })
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
}

/**
 * IMPROVED ANALYSIS METHODS
 */

// Method 1: Find ALL verbatim phrases (not just longest)
function findAllVerbatimPhrases(response, chunk, minPhraseLength = 3) {
    const responseWords = response.toLowerCase().split(/\s+/);
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    
    const phrases = [];
    const usedResponseIndices = new Set();
    
    // Find all matching phrases
    for (let i = 0; i < responseWords.length; i++) {
        if (usedResponseIndices.has(i)) continue;
        
        for (let j = 0; j < chunkWords.length; j++) {
            let matchLength = 0;
            let k = 0;
            
            // Find consecutive match starting here
            while (i + k < responseWords.length && 
                   j + k < chunkWords.length && 
                   responseWords[i + k] === chunkWords[j + k]) {
                matchLength++;
                k++;
            }
            
            if (matchLength >= minPhraseLength) {
                // Mark these indices as used
                for (let m = 0; m < matchLength; m++) {
                    usedResponseIndices.add(i + m);
                }
                
                phrases.push({
                    start: i,
                    length: matchLength,
                    words: responseWords.slice(i, i + matchLength).join(' ')
                });
                break; // Found match, move to next position
            }
        }
    }
    
    return phrases;
}

// Method 2: Calculate verbatim ratio based on RESPONSE length (not max)
function calculateVerbatimRatio(response, chunk) {
    const responseWords = response.toLowerCase().split(/\s+/);
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    
    // Find all verbatim phrases
    const phrases = findAllVerbatimPhrases(response, chunk, 3);
    
    // Count total verbatim words
    const totalVerbatimWords = phrases.reduce((sum, p) => sum + p.length, 0);
    
    // Ratio based on RESPONSE length (what % of response is verbatim)
    const responseBasedRatio = totalVerbatimWords / responseWords.length;
    
    // Also calculate based on chunk length for comparison
    const chunkBasedRatio = totalVerbatimWords / chunkWords.length;
    
    // Find longest single phrase (original method)
    let maxMatch = 0;
    for (let i = 0; i < responseWords.length; i++) {
        for (let j = 0; j < chunkWords.length; j++) {
            let match = 0;
            let k = 0;
            while (i + k < responseWords.length && 
                   j + k < chunkWords.length && 
                   responseWords[i + k] === chunkWords[j + k]) {
                match++;
                k++;
            }
            if (match > maxMatch) maxMatch = match;
        }
    }
    const originalMethodRatio = maxMatch / Math.max(responseWords.length, chunkWords.length);
    
    return {
        totalVerbatimWords,
        totalPhrases: phrases.length,
        responseBasedRatio,      // NEW: % of response that is verbatim
        chunkBasedRatio,         // % of chunk that appears in response
        originalMethodRatio,     // OLD method for comparison
        longestPhrase: maxMatch,
        phrases: phrases.slice(0, 10) // Show first 10 phrases
    };
}

// Method 3: Check for near-verbatim (same words, different order)
function checkNearVerbatim(response, chunk) {
    const responseWords = response.toLowerCase().split(/\s+/);
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    
    // Count how many words from chunk appear in response (in any order)
    const chunkWordSet = new Set(chunkWords);
    const matchingWords = responseWords.filter(w => chunkWordSet.has(w));
    
    return {
        totalWordsInResponse: responseWords.length,
        matchingWords: matchingWords.length,
        matchingRatio: matchingWords.length / responseWords.length
    };
}

async function runImprovedAnalysis() {
    console.log('🔍 IMPROVED VERBATIM ANALYSIS\n');
    console.log('='.repeat(80));
    console.log(`Query: "${testQuery.question}"`);
    console.log('='.repeat(80));
    
    try {
        // Get AI response
        const chatResponse = await makeChatQuery(testQuery.question, testQuery.doc);
        const aiResponse = chatResponse.response;
        const chunksUsed = chatResponse.metadata.chunkSimilarities || [];
        
        console.log(`\n✅ AI Response (${aiResponse.length} chars, ~${aiResponse.split(/\s+/).length} words)`);
        console.log('-'.repeat(80));
        console.log(aiResponse.substring(0, 500) + '...');
        console.log('-'.repeat(80));
        
        // Analyze top chunk
        if (chunksUsed.length > 0) {
            const topChunkInfo = chunksUsed[0];
            const chunkData = await getChunkContent(testQuery.doc, topChunkInfo.index);
            
            if (chunkData) {
                console.log(`\n📄 Analyzing Top Chunk ${topChunkInfo.index} (similarity: ${topChunkInfo.similarity?.toFixed(3)})`);
                console.log(`   Chunk length: ${chunkData.content.length} chars, ~${chunkData.content.split(/\s+/).length} words`);
                console.log('-'.repeat(80));
                
                // IMPROVED ANALYSIS
                const analysis = calculateVerbatimRatio(aiResponse, chunkData.content);
                const nearVerbatim = checkNearVerbatim(aiResponse, chunkData.content);
                
                console.log('\n📊 IMPROVED VERBATIM ANALYSIS:');
                console.log(`   Total verbatim phrases found: ${analysis.totalPhrases}`);
                console.log(`   Total verbatim words: ${analysis.totalVerbatimWords}`);
                console.log(`   Longest single phrase: ${analysis.longestPhrase} words`);
                console.log(`\n   📈 RATIOS:`);
                console.log(`   • Response-based ratio: ${(analysis.responseBasedRatio * 100).toFixed(2)}% (of RESPONSE that is verbatim)`);
                console.log(`   • Chunk-based ratio: ${(analysis.chunkBasedRatio * 100).toFixed(2)}% (of CHUNK that appears in response)`);
                console.log(`   • Original method ratio: ${(analysis.originalMethodRatio * 100).toFixed(2)}% (OLD METHOD - for comparison)`);
                
                console.log(`\n   📝 Sample verbatim phrases (first 10):`);
                analysis.phrases.slice(0, 10).forEach((p, i) => {
                    console.log(`   ${i + 1}. "${p.words}" (${p.length} words)`);
                });
                
                console.log(`\n   🔄 NEAR-VERBATIM ANALYSIS:`);
                console.log(`   • Words from chunk appearing in response: ${nearVerbatim.matchingWords}/${nearVerbatim.totalWordsInResponse}`);
                console.log(`   • Matching word ratio: ${(nearVerbatim.matchingRatio * 100).toFixed(2)}%`);
                
                console.log(`\n   ⚠️  KEY FINDING:`);
                if (analysis.responseBasedRatio > 0.1) {
                    console.log(`   ⚠️  WARNING: ${(analysis.responseBasedRatio * 100).toFixed(1)}% of response is verbatim from chunk!`);
                } else {
                    console.log(`   ✅ Only ${(analysis.responseBasedRatio * 100).toFixed(1)}% of response is verbatim - STRONGLY TRANSFORMATIVE`);
                }
                
                // Show chunk sample
                console.log(`\n   📄 Chunk content sample:`);
                console.log(`   "${chunkData.content.substring(0, 300)}..."`);
            }
        }
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
    }
}

runImprovedAnalysis().catch(console.error);

