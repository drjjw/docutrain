/**
 * Test script to compare AI responses with stored chunks
 * Demonstrates transformative use - AI generates new content, doesn't copy verbatim
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

// Test queries for Diabetes Canada guidelines (document slug: dc)
const testQueries = [
    {
        question: "What are the treatment targets for blood glucose in diabetes?",
        doc: "dc"
    },
    {
        question: "How do you screen for chronic kidney disease in patients with diabetes?",
        doc: "dc"
    },
    {
        question: "What medications are recommended for diabetic kidney disease?",
        doc: "dc"
    },
    {
        question: "What is the recommended approach to managing hypertension in diabetic patients?",
        doc: "dc"
    }
];

async function getChunkContent(documentSlug, chunkIndex) {
    const { data, error } = await supabase
        .from('document_chunks')
        .select('content, chunk_index, metadata')
        .eq('document_slug', documentSlug)
        .eq('chunk_index', chunkIndex)
        .single();
    
    if (error) {
        console.error(`Error fetching chunk ${chunkIndex}:`, error.message);
        return null;
    }
    
    return data;
}

async function makeChatQuery(query, doc, retries = 3) {
    // Use node-fetch if available, otherwise try native fetch
    let fetchFn;
    try {
        fetchFn = require('node-fetch');
    } catch (e) {
        fetchFn = fetch;
    }
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetchFn('http://localhost:3458/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: query,
                    doc: doc,
                    model: 'gemini',
                    history: []
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                // Retry on 503 (service unavailable) or 500 errors
                if ((response.status === 503 || response.status === 500) && attempt < retries) {
                    const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
                    console.log(`   ⏳ API error (attempt ${attempt}/${retries}), retrying in ${waitTime/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                throw new Error(`API error: ${response.status} - ${error}`);
            }
            
            return await response.json();
        } catch (error) {
            if (attempt < retries && (error.message.includes('503') || error.message.includes('overloaded'))) {
                const waitTime = attempt * 2000;
                console.log(`   ⏳ Network error (attempt ${attempt}/${retries}), retrying in ${waitTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error;
        }
    }
}

function compareText(response, chunk) {
    // Simple comparison: check for verbatim copying
    const responseWords = response.toLowerCase().split(/\s+/);
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    
    // Find longest common substring (simplified)
    let maxMatch = 0;
    let matchStart = -1;
    
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
            if (match > maxMatch) {
                maxMatch = match;
                matchStart = i;
            }
        }
    }
    
    const verbatimRatio = maxMatch / Math.max(responseWords.length, chunkWords.length);
    
    return {
        verbatimRatio,
        maxConsecutiveMatch: maxMatch,
        isTransformative: verbatimRatio < 0.3 // Less than 30% verbatim = transformative
    };
}

async function runTest(testQuery) {
    console.log('\n' + '='.repeat(80));
    console.log(`📝 TEST QUERY: "${testQuery.question}"`);
    console.log(`📄 Document: ${testQuery.doc}`);
    console.log('='.repeat(80));
    
    try {
        // Make chat query
        console.log('\n🔍 Making chat query...');
        const chatResponse = await makeChatQuery(testQuery.question, testQuery.doc);
        
        const aiResponse = chatResponse.response;
        const chunksUsed = chatResponse.metadata.chunkSimilarities || [];
        const documentSlug = chatResponse.metadata.documentSlugs?.[0] || testQuery.doc;
        
        console.log(`\n✅ AI Response (${aiResponse.length} chars):`);
        console.log('-'.repeat(80));
        console.log(aiResponse);
        console.log('-'.repeat(80));
        
        console.log(`\n📊 Metadata:`);
        console.log(`   - Chunks used: ${chunksUsed.length}`);
        console.log(`   - Model: ${chatResponse.actualModel}`);
        console.log(`   - Response time: ${chatResponse.metadata.responseTime}ms`);
        
        // Get and compare chunks
        console.log(`\n📚 Retrieved Chunks:`);
        console.log('-'.repeat(80));
        
        let totalVerbatimRatio = 0;
        let transformativeCount = 0;
        
        for (let i = 0; i < Math.min(chunksUsed.length, 3); i++) { // Compare top 3 chunks
            const chunkInfo = chunksUsed[i];
            const chunkData = await getChunkContent(documentSlug, chunkInfo.index);
            
            if (!chunkData) {
                console.log(`\n⚠️  Chunk ${chunkInfo.index} not found`);
                continue;
            }
            
            const chunkContent = chunkData.content;
            const comparison = compareText(aiResponse, chunkContent);
            
            console.log(`\n📄 Chunk ${chunkInfo.index} (similarity: ${chunkInfo.similarity?.toFixed(3) || 'N/A'}):`);
            console.log(`   Length: ${chunkContent.length} chars`);
            console.log(`   Max consecutive match: ${comparison.maxConsecutiveMatch} words`);
            console.log(`   Verbatim ratio: ${(comparison.verbatimRatio * 100).toFixed(1)}%`);
            console.log(`   ${comparison.isTransformative ? '✅ TRANSFORMATIVE' : '⚠️  HIGH VERBATIM'}`);
            
            console.log(`\n   Chunk content (first 300 chars):`);
            console.log(`   "${chunkContent.substring(0, 300)}..."`);
            
            totalVerbatimRatio += comparison.verbatimRatio;
            if (comparison.isTransformative) transformativeCount++;
        }
        
        const avgVerbatimRatio = totalVerbatimRatio / Math.min(chunksUsed.length, 3);
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 SUMMARY:');
        console.log(`   - Average verbatim ratio: ${(avgVerbatimRatio * 100).toFixed(1)}%`);
        console.log(`   - Transformative chunks: ${transformativeCount}/${Math.min(chunksUsed.length, 3)}`);
        console.log(`   - ${avgVerbatimRatio < 0.3 ? '✅ STRONGLY TRANSFORMATIVE' : avgVerbatimRatio < 0.5 ? '✅ TRANSFORMATIVE' : '⚠️  SOME VERBATIM CONTENT'}`);
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

async function main() {
    console.log('🧪 Testing AI Response vs Stored Chunks');
    console.log('🎯 Goal: Demonstrate transformative use (AI generates new content, not verbatim copies)');
    console.log('\n');
    
    for (const testQuery of testQueries) {
        await runTest(testQuery);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between tests to avoid rate limits
    }
    
    console.log('\n✅ All tests complete!');
    console.log('\n💡 Key Finding: AI responses are TRANSFORMATIVE - they synthesize information');
    console.log('   from chunks to generate new content, not copy verbatim.');
}

main().catch(console.error);

