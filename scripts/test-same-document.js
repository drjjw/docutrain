#!/usr/bin/env node

/**
 * Test script to test abstract/keyword generation on the same document
 * that's causing the hang: 829b02b0-e262-4430-8a0a-bef2a32c3f75
 */

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { generateAbstractAndKeywords } = require('../lib/processors/ai-content-generator');
const { downloadPDFFromStorage, extractPDFTextWithPageMarkers } = require('../lib/processors/pdf-extractor');
const { chunkText } = require('../lib/processors/text-chunker');
require('dotenv').config();

// Initialize clients
const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_DOCUMENT_ID = '829b02b0-e262-4430-8a0a-bef2a32c3f75';

async function testSameDocument() {
    console.log('🧪 Testing Abstract/Keyword Generation on Problem Document');
    console.log('=' .repeat(70));
    console.log(`Document ID: ${USER_DOCUMENT_ID}\n`);
    
    try {
        // Step 1: Get user document
        console.log('📥 Step 1: Fetching user document...');
        const { data: userDoc, error: docError } = await supabase
            .from('user_documents')
            .select('*')
            .eq('id', USER_DOCUMENT_ID)
            .single();
        
        if (docError || !userDoc) {
            throw new Error(`Failed to fetch document: ${docError?.message}`);
        }
        
        console.log(`✓ Document found: ${userDoc.title}`);
        console.log(`  Status: ${userDoc.status}`);
        console.log(`  File path: ${userDoc.file_path}\n`);
        
        // Step 2: Download PDF
        console.log('📥 Step 2: Downloading PDF from storage...');
        const pdfBuffer = await downloadPDFFromStorage(supabase, userDoc.file_path);
        console.log(`✓ PDF downloaded: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);
        
        // Step 3: Extract text
        console.log('📄 Step 3: Extracting text from PDF...');
        const { text, pages } = await extractPDFTextWithPageMarkers(pdfBuffer, {
            fileSize: pdfBuffer.length,
            fileSizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2)
        });
        console.log(`✓ Text extracted: ${text.length.toLocaleString()} chars, ${pages} pages\n`);
        
        // Step 4: Chunk text
        console.log('✂️  Step 4: Chunking text...');
        const chunks = chunkText(text, 500, 100);
        console.log(`✓ Text chunked: ${chunks.length} chunks\n`);
        
        // Step 5: Test abstract and keyword generation
        console.log('🤖 Step 5: Testing AI abstract and keyword generation...');
        console.log(`   Chunks: ${chunks.length}`);
        console.log(`   Total text: ${chunks.reduce((sum, c) => sum + c.content.length, 0).toLocaleString()} chars`);
        console.log(`   Expected timeout: 120 seconds (2 minutes)\n`);
        
        const startTime = Date.now();
        
        try {
            const result = await generateAbstractAndKeywords(
                openaiClient,
                chunks,
                userDoc.title,
                {}
            );
            
            const duration = Date.now() - startTime;
            console.log(`\n✅✅ SUCCESS! Completed in ${(duration / 1000).toFixed(1)}s`);
            console.log(`\nAbstract (${result.abstract?.length || 0} chars):`);
            console.log(result.abstract || '(null)');
            console.log(`\nKeywords (${result.keywords?.length || 0} items):`);
            if (result.keywords && result.keywords.length > 0) {
                console.log(result.keywords.slice(0, 10).map(k => `  - ${k.term} (${k.weight})`).join('\n'));
                if (result.keywords.length > 10) {
                    console.log(`  ... and ${result.keywords.length - 10} more`);
                }
            } else {
                console.log('  (null)');
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`\n❌ FAILED after ${(duration / 1000).toFixed(1)}s`);
            console.error(`Error: ${error.message}`);
            console.error(`Error type: ${error.constructor.name}`);
            console.error(`Stack: ${error.stack}`);
            throw error;
        }
        
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testSameDocument();

