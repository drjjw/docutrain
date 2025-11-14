/**
 * Fetch all chunks used in test queries for appendix
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

const testQueries = [
    {
        question: "How do you screen for chronic kidney disease in patients with diabetes?",
        doc: "dc",
        testName: "Test 1: Screening"
    },
    {
        question: "What medications are recommended for diabetic kidney disease?",
        doc: "dc",
        testName: "Test 2: Medications"
    }
];

async function makeChatQuery(query, doc) {
    const response = await fetch('http://localhost:3458/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, doc: doc, model: 'gemini', history: [] })
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
    }
    return await response.json();
}

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

async function fetchAllChunksForTest(testQuery) {
    console.log(`\n📡 Fetching chunks for: ${testQuery.testName}`);
    console.log(`Query: "${testQuery.question}"`);
    
    try {
        const chatResponse = await makeChatQuery(testQuery.question, testQuery.doc);
        const chunksUsed = chatResponse.metadata.chunkSimilarities || [];
        
        console.log(`Found ${chunksUsed.length} chunks`);
        
        const chunksWithContent = [];
        
        for (const chunkInfo of chunksUsed) {
            const chunkData = await getChunkContent(testQuery.doc, chunkInfo.index);
            if (chunkData) {
                chunksWithContent.push({
                    index: chunkInfo.index,
                    similarity: chunkInfo.similarity,
                    content: chunkData.content.substring(0, 200), // First 200 chars
                    fullLength: chunkData.content.length,
                    pageNumber: chunkData.metadata?.page_number || 'N/A'
                });
            }
        }
        
        return {
            testName: testQuery.testName,
            query: testQuery.question,
            totalChunks: chunksUsed.length,
            chunks: chunksWithContent
        };
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log('🔍 FETCHING ALL CHUNKS USED IN TESTS');
    console.log('='.repeat(80));
    
    const results = [];
    
    for (const testQuery of testQueries) {
        const result = await fetchAllChunksForTest(testQuery);
        if (result) {
            results.push(result);
        }
        // Delay between queries
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Output in markdown format for appendix
    console.log('\n\n' + '='.repeat(80));
    console.log('## APPENDIX: All Chunks Used in Tests');
    console.log('='.repeat(80));
    
    for (const result of results) {
        console.log(`\n### ${result.testName}`);
        console.log(`\n**Query:** "${result.query}"`);
        console.log(`**Total Chunks Used:** ${result.totalChunks}`);
        console.log(`\n| Chunk Index | Similarity | Page | Content Preview (first 200 chars) |`);
        console.log(`|-------------|------------|------|-----------------------------------|`);
        
        for (const chunk of result.chunks) {
            const contentPreview = chunk.content.replace(/\n/g, ' ').substring(0, 150) + '...';
            console.log(`| ${chunk.index} | ${chunk.similarity?.toFixed(3) || 'N/A'} | ${chunk.pageNumber} | ${contentPreview} |`);
        }
    }
}

main().catch(console.error);


