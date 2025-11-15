/**
 * Analyze SMH document for Ancef dosing question
 * Uses improved verbatim analysis methodology
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const testQuery = {
    question: "what is the dose of ancef in peritonitis?",
    doc: "smh"
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
    const response = await fetch('http://localhost:3458/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: query, 
            doc: doc, 
            model: 'gemini', 
            history: [] 
        })
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
    }
    return await response.json();
}

function findAllVerbatimPhrases(response, chunk, minPhraseLength = 3) {
    const responseWords = response.toLowerCase().split(/\s+/);
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    
    const phrases = [];
    const usedResponseIndices = new Set();
    
    for (let i = 0; i < responseWords.length; i++) {
        if (usedResponseIndices.has(i)) continue;
        
        for (let j = 0; j < chunkWords.length; j++) {
            let matchLength = 0;
            let k = 0;
            
            while (i + k < responseWords.length && 
                   j + k < chunkWords.length && 
                   responseWords[i + k] === chunkWords[j + k]) {
                matchLength++;
                k++;
            }
            
            if (matchLength >= minPhraseLength) {
                for (let m = 0; m < matchLength; m++) {
                    usedResponseIndices.add(i + m);
                }
                
                phrases.push({
                    start: i,
                    length: matchLength,
                    words: responseWords.slice(i, i + matchLength).join(' ')
                });
                break;
            }
        }
    }
    
    return phrases;
}

function calculateVerbatimRatio(response, chunk) {
    const responseWords = response.toLowerCase().split(/\s+/);
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    
    const phrases = findAllVerbatimPhrases(response, chunk, 3);
    const totalVerbatimWords = phrases.reduce((sum, p) => sum + p.length, 0);
    
    const responseBasedRatio = totalVerbatimWords / responseWords.length;
    const chunkBasedRatio = totalVerbatimWords / chunkWords.length;
    
    // Find longest single phrase (original method for comparison)
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
        responseBasedRatio,
        chunkBasedRatio,
        originalMethodRatio,
        longestPhrase: maxMatch,
        phrases: phrases
    };
}

async function analyzeQuery() {
    console.log('🔍 ANALYZING SMH DOCUMENT');
    console.log('='.repeat(80));
    console.log(`Query: "${testQuery.question}"`);
    console.log(`Document: ${testQuery.doc}`);
    console.log('='.repeat(80));
    
    try {
        // Get AI response
        console.log('\n📡 Making chat query...');
        const chatResponse = await makeChatQuery(testQuery.question, testQuery.doc);
        const aiResponse = chatResponse.response;
        const chunksUsed = chatResponse.metadata.chunkSimilarities || [];
        
        console.log(`\n✅ AI Response (${aiResponse.length} chars, ~${aiResponse.split(/\s+/).length} words)`);
        console.log('-'.repeat(80));
        console.log(aiResponse);
        console.log('-'.repeat(80));
        
        console.log(`\n📊 Metadata:`);
        console.log(`   - Chunks used: ${chunksUsed.length}`);
        console.log(`   - Model: ${chatResponse.actualModel || 'N/A'}`);
        console.log(`   - Response time: ${chatResponse.metadata.responseTime || 'N/A'}ms`);
        
        // Analyze top chunks
        console.log(`\n📚 ANALYZING TOP CHUNKS:`);
        console.log('='.repeat(80));
        
        let totalResponseRatio = 0;
        let totalChunkRatio = 0;
        let chunkCount = 0;
        
        for (let i = 0; i < Math.min(chunksUsed.length, 5); i++) {
            const chunkInfo = chunksUsed[i];
            const chunkData = await getChunkContent(testQuery.doc, chunkInfo.index);
            
            if (!chunkData) {
                console.log(`\n⚠️  Chunk ${chunkInfo.index} not found`);
                continue;
            }
            
            console.log(`\n📄 Chunk ${chunkInfo.index} (similarity: ${chunkInfo.similarity?.toFixed(3) || 'N/A'}):`);
            console.log(`   Length: ${chunkData.content.length} chars, ~${chunkData.content.split(/\s+/).length} words`);
            
            const analysis = calculateVerbatimRatio(aiResponse, chunkData.content);
            
            console.log(`\n   🔍 VERBATIM ANALYSIS:`);
            console.log(`   - Total verbatim phrases: ${analysis.totalPhrases}`);
            console.log(`   - Total verbatim words: ${analysis.totalVerbatimWords}`);
            console.log(`   - Longest phrase: ${analysis.longestPhrase} words`);
            console.log(`   - Response-based ratio: ${(analysis.responseBasedRatio * 100).toFixed(2)}% (of RESPONSE)`);
            console.log(`   - Chunk-based ratio: ${(analysis.chunkBasedRatio * 100).toFixed(2)}% (of CHUNK)`);
            console.log(`   - Original method ratio: ${(analysis.originalMethodRatio * 100).toFixed(2)}% (for comparison)`);
            
            if (analysis.phrases.length > 0) {
                console.log(`\n   📝 Verbatim phrases found:`);
                analysis.phrases.slice(0, 10).forEach((p, idx) => {
                    console.log(`   ${idx + 1}. "${p.words}" (${p.length} words)`);
                });
            }
            
            console.log(`\n   📄 Chunk content sample (first 400 chars):`);
            console.log(`   "${chunkData.content.substring(0, 400)}..."`);
            
            totalResponseRatio += analysis.responseBasedRatio;
            totalChunkRatio += analysis.chunkBasedRatio;
            chunkCount++;
        }
        
        const avgResponseRatio = totalResponseRatio / chunkCount;
        const avgChunkRatio = totalChunkRatio / chunkCount;
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 SUMMARY:');
        console.log(`   - Chunks analyzed: ${chunkCount}`);
        console.log(`   - Average response-based verbatim ratio: ${(avgResponseRatio * 100).toFixed(2)}%`);
        console.log(`   - Average chunk-based verbatim ratio: ${(avgChunkRatio * 100).toFixed(2)}%`);
        console.log(`   - Original synthesis: ${((1 - avgResponseRatio) * 100).toFixed(1)}%`);
        
        if (avgResponseRatio < 0.1) {
            console.log(`   ✅ STRONGLY TRANSFORMATIVE (<10% verbatim)`);
        } else if (avgResponseRatio < 0.2) {
            console.log(`   ✅ TRANSFORMATIVE (10-20% verbatim)`);
        } else {
            console.log(`   ⚠️  SOME VERBATIM CONTENT (>20% verbatim)`);
        }
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

analyzeQuery().catch(console.error);



