#!/usr/bin/env node
/**
 * Script to generate quizzes for all documents with show_quizzes enabled
 * This will regenerate quizzes with the new 5-option format
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const documentRegistry = require('../lib/document-registry');
const { generateQuizQuestions } = require('../lib/processors/quiz-generator');
const { getRandomChunks, convertDbChunksToAIFormat, getChunkCount } = require('../lib/db/chunk-operations');
const {
    createQuiz,
    storeQuizQuestions,
    updateQuizStatus,
    updateDocumentQuizzesGenerated
} = require('../lib/db/quiz-operations');
const processingLogger = require('../lib/processing-logger');
const { debugLog } = require('../lib/utils/debug');

// Initialize Supabase clients
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize OpenAI client
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✓ OpenAI client initialized');
} else {
    console.error('❌ OPENAI_API_KEY not found - cannot generate quizzes');
    process.exit(1);
}

async function generateQuizForDocument(documentSlug, documentTitle) {
    console.log(`\n📝 Generating quiz for: ${documentTitle} (${documentSlug})`);
    
    try {
        // Get chunk count to calculate question count
        const chunkCount = await getChunkCount(supabase, documentSlug);
        if (chunkCount === 0) {
            console.log(`   ⚠️  No chunks available - skipping`);
            return { success: false, reason: 'No chunks' };
        }
        
        // Calculate question count: 1 per 2 chunks, min 10, max 100
        const questionCount = Math.min(Math.max(Math.floor(chunkCount / 2), 10), 100);
        console.log(`   📊 Chunks: ${chunkCount}, Questions: ${questionCount}`);
        
        // Get random chunks
        const chunksNeeded = Math.max(questionCount * 2, 10);
        const randomChunks = await getRandomChunks(supabase, documentSlug, chunksNeeded);
        
        if (!randomChunks || randomChunks.length === 0) {
            console.log(`   ⚠️  No chunks retrieved - skipping`);
            return { success: false, reason: 'No chunks retrieved' };
        }
        
        // Convert chunks to AI format
        const chunksForAI = convertDbChunksToAIFormat(randomChunks);
        
        // Create quiz record with 'generating' status
        const quizSize = 5; // Default quiz size per attempt
        const userId = null; // System generation
        const quiz = await createQuiz(supabase, documentSlug, questionCount, userId, quizSize);
        console.log(`   ✓ Created quiz metadata record`);
        
        // Log start
        await processingLogger.started(supabase, null, processingLogger.STAGES.QUIZ, 
            'Starting quiz generation', { documentSlug }, 'vps');
        
        // Generate questions
        console.log(`   🤖 Generating ${questionCount} questions...`);
        const questions = await generateQuizQuestions(
            openaiClient,
            chunksForAI,
            documentTitle || documentSlug,
            questionCount,
            {
                processingLogger,
                supabase,
                documentSlug
            }
        );
        
        if (!questions || questions.length === 0) {
            await updateQuizStatus(supabase, documentSlug, 'failed');
            console.log(`   ❌ Failed to generate questions`);
            return { success: false, reason: 'Generation failed' };
        }
        
        console.log(`   ✓ Generated ${questions.length} questions`);
        
        // Store questions
        await storeQuizQuestions(supabase, documentSlug, questions);
        console.log(`   ✓ Stored ${questions.length} questions`);
        
        // Update quiz status to completed
        await updateQuizStatus(supabase, documentSlug, 'completed');
        
        // Update documents.quizzes_generated flag
        await updateDocumentQuizzesGenerated(supabase, documentSlug, true);
        
        // Log completion
        await processingLogger.completed(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
            `Quiz generation completed successfully`, { 
                questionCount: questions.length,
                documentSlug 
            });
        
        console.log(`   ✅ Success! Generated ${questions.length} questions`);
        return { success: true, questionCount: questions.length };
        
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        await updateQuizStatus(supabase, documentSlug, 'failed');
        await processingLogger.error(supabase, documentSlug, documentSlug,
            'Quiz generation error', error, { documentSlug }, 'vps');
        return { success: false, reason: error.message };
    }
}

async function main() {
    console.log('🚀 Starting quiz generation for all documents with show_quizzes enabled\n');
    
    // Get all documents with show_quizzes enabled
    const { data: documents, error } = await adminSupabase
        .from('documents')
        .select('slug, title')
        .eq('show_quizzes', true)
        .order('slug');
    
    if (error) {
        console.error('❌ Error fetching documents:', error);
        process.exit(1);
    }
    
    if (!documents || documents.length === 0) {
        console.log('ℹ️  No documents with show_quizzes enabled');
        return;
    }
    
    console.log(`Found ${documents.length} document(s) with quizzes enabled:\n`);
    documents.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.title} (${doc.slug})`);
    });
    
    console.log(`\n⏳ Starting generation...`);
    
    const results = [];
    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const result = await generateQuizForDocument(doc.slug, doc.title);
        results.push({ document: doc, ...result });
        
        // Small delay between documents to avoid rate limiting
        if (i < documents.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
    }
    
    // Summary
    console.log(`\n\n📊 Summary:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    successful.forEach(r => {
        console.log(`   • ${r.document.title}: ${r.questionCount} questions`);
    });
    
    if (failed.length > 0) {
        console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
        failed.forEach(r => {
            console.log(`   • ${r.document.title}: ${r.reason || 'Unknown error'}`);
        });
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n✨ Done!`);
}

// Run the script
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

