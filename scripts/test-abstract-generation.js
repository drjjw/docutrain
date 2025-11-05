/**
 * Test script to isolate abstract/keyword generation issues
 * This will help us understand why the OpenAI API calls are hanging
 */

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

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

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test chunks (simulated)
const testChunks = [
    { content: 'This is a test document about diabetes management. It covers various treatment approaches.' },
    { content: 'The document discusses insulin therapy, diet management, and exercise recommendations.' },
    { content: 'Key points include monitoring blood glucose levels and working with healthcare providers.' }
];

const testTitle = 'Test Document: Diabetes Management';

/**
 * Fetch actual chunks from a document for testing
 */
async function fetchRealChunks(documentSlug) {
    console.log(`\n📥 Fetching chunks for document: ${documentSlug}`);
    
    let allChunks = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('document_chunks')
            .select('content, chunk_index')
            .eq('document_slug', documentSlug)
            .order('chunk_index', { ascending: true })
            .range(from, from + pageSize - 1);
        
        if (error) {
            console.error(`❌ Error fetching chunks: ${error.message}`);
            return null;
        }
        
        if (!data || data.length === 0) {
            break;
        }
        
        allChunks = allChunks.concat(data.map(chunk => ({
            content: chunk.content,
            index: chunk.chunk_index
        })));
        
        if (data.length < pageSize) {
            break;
        }
        
        from += pageSize;
    }
    
    console.log(`✓ Fetched ${allChunks.length} chunks`);
    return allChunks;
}

/**
 * Test abstract generation with detailed logging
 */
async function testAbstractGeneration() {
    console.log('🧪 Testing Abstract Generation...');
    console.log('=' .repeat(60));
    
    const chunks = global.testChunks || testChunks;
    const title = global.testTitle || testTitle;
    
    const combinedText = chunks.map(chunk => chunk.content).join('\n\n');
    const textForAbstract = combinedText.length > 400000 
        ? combinedText.substring(0, 400000) + '...'
        : combinedText;
    
    console.log(`📝 Text length: ${textForAbstract.length} characters`);
    console.log(`📝 Number of chunks: ${chunks.length}`);
    
    const startTime = Date.now();
    
    try {
        console.log('\n⏱️  Starting API call at:', new Date().toISOString());
        console.log('   SDK timeout: 30 seconds');
        console.log('   Hard timeout: 45 seconds');
        
        const apiPromise = openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at creating concise, informative abstracts from document content. Create a 100-word abstract that captures the key themes, purpose, and scope of the document.'
                },
                {
                    role: 'user',
                    content: `Please create a 100-word abstract for a document titled "${title}". Base your abstract on the following content from the document:\n\n${textForAbstract}\n\nProvide ONLY the abstract text, no additional commentary. The abstract should be exactly 100 words.`
                }
            ],
            temperature: 0.7,
            max_tokens: 200
        }, {
            timeout: 30000 // 30 second SDK timeout
        });
        
        const hardTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Hard timeout: OpenAI abstract API call exceeded 45 seconds'));
            }, 45000); // 45 second hard timeout
        });
        
        console.log('   Waiting for Promise.race...');
        const response = await Promise.race([apiPromise, hardTimeoutPromise]);
        
        const duration = Date.now() - startTime;
        console.log(`\n✅ Abstract generated successfully in ${duration}ms`);
        console.log('Response:', response.choices[0]?.message?.content?.trim());
        
        return response.choices[0]?.message?.content?.trim();
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`\n❌ Abstract generation failed after ${duration}ms`);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error status:', error.status);
        console.error('Full error:', error);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        
        throw error;
    }
}

/**
 * Test keyword generation with detailed logging
 */
async function testKeywordGeneration() {
    console.log('\n\n🧪 Testing Keyword Generation...');
    console.log('=' .repeat(60));
    
    const chunks = global.testChunks || testChunks;
    const title = global.testTitle || testTitle;
    
    const combinedText = chunks.map(chunk => chunk.content).join('\n\n');
    const textForKeywords = combinedText.length > 400000 
        ? combinedText.substring(0, 400000) + '...'
        : combinedText;
    
    console.log(`📝 Text length: ${textForKeywords.length} characters`);
    
    const startTime = Date.now();
    
    try {
        console.log('\n⏱️  Starting API call at:', new Date().toISOString());
        console.log('   SDK timeout: 30 seconds');
        console.log('   Hard timeout: 45 seconds');
        
        const apiPromise = openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at analyzing document content and extracting key terms and concepts. Identify the most important keywords, phrases, and concepts that would be useful for a word cloud visualization. Focus on domain-specific terms, key concepts, and important topics. Always respond with valid JSON.'
                },
                {
                    role: 'user',
                    content: `Analyze the following document content and extract 20-30 key terms, phrases, and concepts that best represent this document. For each term, assign a weight from 0.1 to 1.0 based on its importance (1.0 = most important, 0.1 = less important but still relevant).\n\nDocument title: "${title}"\n\nContent:\n${textForKeywords}\n\nReturn your response as a JSON object with a "keywords" property containing an array of objects, each with "term" (string) and "weight" (number) properties. Example format:\n{"keywords": [{"term": "kidney disease", "weight": 0.95}, {"term": "chronic kidney disease", "weight": 0.90}, {"term": "treatment", "weight": 0.75}]}\n\nProvide ONLY the JSON object, no additional commentary.`
                }
            ],
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: "json_object" }
        }, {
            timeout: 30000 // 30 second SDK timeout
        });
        
        const hardTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Hard timeout: OpenAI keyword API call exceeded 45 seconds'));
            }, 45000); // 45 second hard timeout
        });
        
        console.log('   Waiting for Promise.race...');
        const response = await Promise.race([apiPromise, hardTimeoutPromise]);
        
        const duration = Date.now() - startTime;
        console.log(`\n✅ Keywords generated successfully in ${duration}ms`);
        
        const content = response.choices[0]?.message?.content?.trim();
        console.log('Response:', content);
        
        // Try to parse JSON
        try {
            const parsed = JSON.parse(content);
            console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
        } catch (parseError) {
            console.error('⚠️  Failed to parse JSON:', parseError.message);
        }
        
        return content;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`\n❌ Keyword generation failed after ${duration}ms`);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error status:', error.status);
        console.error('Full error:', error);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        
        throw error;
    }
}

/**
 * Test both in parallel (like the actual code does)
 */
async function testParallel() {
    console.log('\n\n🧪 Testing Parallel Execution (Abstract + Keywords)...');
    console.log('=' .repeat(60));
    
    const chunks = global.testChunks || testChunks;
    const title = global.testTitle || testTitle;
    
    const startTime = Date.now();
    
    try {
        console.log('\n⏱️  Starting parallel execution at:', new Date().toISOString());
        console.log(`   Document: ${title}`);
        console.log(`   Chunks: ${chunks.length}`);
        console.log('   Outer timeout: 60 seconds');
        
        // Simulate the actual generateAbstract and generateKeywords functions
        async function simAbstract() {
            const combinedText = chunks.map(chunk => chunk.content).join('\n\n');
            const textForAbstract = combinedText.length > 400000 
                ? combinedText.substring(0, 400000) + '...'
                : combinedText;
            
            const apiPromise = openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating concise, informative abstracts from document content. Create a 100-word abstract that captures the key themes, purpose, and scope of the document.'
                    },
                    {
                        role: 'user',
                        content: `Please create a 100-word abstract for a document titled "${title}". Base your abstract on the following content from the document:\n\n${textForAbstract}\n\nProvide ONLY the abstract text, no additional commentary. The abstract should be exactly 100 words.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            }, { timeout: 30000 });
            
            const hardTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Hard timeout: OpenAI abstract API call exceeded 45 seconds'));
                }, 45000);
            });
            
            const response = await Promise.race([apiPromise, hardTimeoutPromise]);
            return response.choices[0]?.message?.content?.trim();
        }
        
        async function simKeywords() {
            const combinedText = chunks.map(chunk => chunk.content).join('\n\n');
            const textForKeywords = combinedText.length > 400000 
                ? combinedText.substring(0, 400000) + '...'
                : combinedText;
            
            const apiPromise = openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at analyzing document content and extracting key terms and concepts. Identify the most important keywords, phrases, and concepts that would be useful for a word cloud visualization. Focus on domain-specific terms, key concepts, and important topics. Always respond with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: `Analyze the following document content and extract 20-30 key terms, phrases, and concepts that best represent this document. For each term, assign a weight from 0.1 to 1.0 based on its importance (1.0 = most important, 0.1 = less important but still relevant).\n\nDocument title: "${title}"\n\nContent:\n${textForKeywords}\n\nReturn your response as a JSON object with a "keywords" property containing an array of objects, each with "term" (string) and "weight" (number) properties. Example format:\n{"keywords": [{"term": "kidney disease", "weight": 0.95}, {"term": "chronic kidney disease", "weight": 0.90}, {"term": "treatment", "weight": 0.75}]}\n\nProvide ONLY the JSON object, no additional commentary.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 800,
                response_format: { type: "json_object" }
            }, { timeout: 30000 });
            
            const hardTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Hard timeout: OpenAI keyword API call exceeded 45 seconds'));
                }, 45000);
            });
            
            const response = await Promise.race([apiPromise, hardTimeoutPromise]);
            return response.choices[0]?.message?.content?.trim();
        }
        
        const abstractPromise = simAbstract();
        const keywordPromise = simKeywords();
        
        const parallelPromise = Promise.all([abstractPromise, keywordPromise]);
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Hard timeout: Abstract/keyword generation exceeded 60 seconds'));
            }, 60000);
        });
        
        console.log('   Waiting for Promise.race with parallel operations...');
        const [abstract, keywords] = await Promise.race([parallelPromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        console.log(`\n✅✅ Both operations completed successfully in ${duration}ms`);
        console.log('Abstract:', abstract?.substring(0, 100) + '...');
        console.log('Keywords:', keywords?.substring(0, 100) + '...');
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`\n❌ Parallel execution failed after ${duration}ms`);
        console.error('Error:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

/**
 * Test with real document chunks
 */
async function testWithRealDocument(documentSlug, documentTitle) {
    console.log('\n\n🧪 Testing with REAL Document Data...');
    console.log('=' .repeat(60));
    
    const chunks = await fetchRealChunks(documentSlug);
    if (!chunks || chunks.length === 0) {
        console.error('❌ Could not fetch chunks');
        return;
    }
    
    console.log(`\n📊 Document stats:`);
    console.log(`   Chunks: ${chunks.length}`);
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    console.log(`   Total characters: ${totalChars.toLocaleString()}`);
    console.log(`   Average chunk size: ${Math.round(totalChars / chunks.length)} chars`);
    
    // Update test data
    const originalChunks = testChunks;
    const originalTitle = testTitle;
    
    // Temporarily replace with real data
    global.testChunks = chunks;
    global.testTitle = documentTitle;
    
    try {
        console.log('\n⏱️  Testing abstract generation with REAL data...');
        await testAbstractGeneration();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n⏱️  Testing keyword generation with REAL data...');
        await testKeywordGeneration();
        
        // Test parallel execution with real data
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('\n⏱️  Testing parallel execution with REAL data...');
        await testParallel();
        
    } finally {
        // Restore original test data
        global.testChunks = originalChunks;
        global.testTitle = originalTitle;
    }
}

/**
 * Main test function
 */
async function main() {
    console.log('🔍 Abstract/Keyword Generation Troubleshooting Test');
    console.log('=' .repeat(60));
    console.log('Testing OpenAI API calls to isolate hanging issues\n');
    
    try {
        // Test 1: Small test data (baseline)
        console.log('📋 Test 1: Small test data (baseline)');
        await testAbstractGeneration();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await testKeywordGeneration();
        
        // Test 2: Real document data (if provided)
        const documentSlug = process.argv[2];
        if (documentSlug) {
            const { data: doc } = await supabase
                .from('documents')
                .select('title')
                .eq('slug', documentSlug)
                .single();
            
            if (doc) {
                await testWithRealDocument(documentSlug, doc.title);
                
                // Test 3: Parallel execution (the actual scenario)
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log('\n\n🧪 Testing Parallel Execution (like production code)...');
                await testParallel();
            } else {
                console.log(`\n⚠️  Document not found: ${documentSlug}`);
            }
        } else {
            console.log('\n💡 Tip: Run with document slug to test with real data:');
            console.log('   node scripts/test-abstract-generation.js <document-slug>');
        }
        
        console.log('\n\n✅ All tests completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('\n\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the tests
main();

