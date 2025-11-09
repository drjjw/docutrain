/**
 * Quiz routes
 * Handles quiz generation endpoint
 */

const express = require('express');
const router = express.Router();
const { authenticateUser, checkDocumentAccess } = require('./chat-helpers');
const { getRandomChunks, convertDbChunksToAIFormat } = require('../db/chunk-operations');
const { generateQuizQuestions } = require('../processors/quiz-generator');
const { debugLog } = require('../utils/debug');

/**
 * Create quiz router
 */
function createQuizRouter(dependencies) {
    const {
        supabase,
        openaiClient,
        documentRegistry
    } = dependencies;

    /**
     * POST /api/quiz/generate
     * Generate quiz questions from random document chunks
     */
    router.post('/generate', async (req, res) => {
        const startTime = Date.now();
        
        try {
            console.log('📝 Quiz generation request received');
            console.log('Request body:', JSON.stringify(req.body));
            console.log('Request headers:', JSON.stringify(req.headers));
            
            const { documentSlug, numQuestions = 5 } = req.body;
            
            if (!documentSlug) {
                console.log('❌ Missing documentSlug');
                return res.status(400).json({
                    error: 'documentSlug is required'
                });
            }
            
            // Validate numQuestions
            const questionCount = parseInt(numQuestions, 10);
            if (isNaN(questionCount) || questionCount < 1 || questionCount > 20) {
                console.log('❌ Invalid numQuestions:', numQuestions);
                return res.status(400).json({
                    error: 'numQuestions must be between 1 and 20'
                });
            }
            
            debugLog('📝 Quiz generation request');
            debugLog(`   Document: ${documentSlug}`);
            debugLog(`   Questions: ${questionCount}`);
            
            // Authenticate user
            console.log('🔐 Authenticating user...');
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            console.log('✅ User authenticated:', userId || 'anonymous');
            
            // Check document access
            console.log('🔍 Checking document access...');
            const accessResult = await checkDocumentAccess([documentSlug], userId, supabase, null);
            if (!accessResult.hasAccess) {
                console.log('❌ Access denied:', accessResult.error);
                return res.status(accessResult.error.status).json({
                    error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                    message: accessResult.error.message
                });
            }
            console.log('✅ Document access granted');
            
            // Get document info from registry
            console.log('📚 Getting document from registry...');
            const docInfo = await documentRegistry.getDocumentBySlug(documentSlug);
            if (!docInfo) {
                console.log('❌ Document not found in registry:', documentSlug);
                return res.status(404).json({
                    error: 'Document not found',
                    message: `Document "${documentSlug}" not found in registry`
                });
            }
            console.log('✅ Document found:', docInfo.title);
            
            // Get random chunks (need enough chunks for good question generation)
            // Request more chunks than questions to give AI more context
            const chunksNeeded = Math.max(questionCount * 2, 10);
            debugLog(`   Fetching ${chunksNeeded} random chunks...`);
            console.log(`📦 Fetching ${chunksNeeded} random chunks...`);
            
            const randomChunks = await getRandomChunks(supabase, documentSlug, chunksNeeded);
            console.log(`✅ Retrieved ${randomChunks.length} chunks`);
            
            if (!randomChunks || randomChunks.length === 0) {
                console.log('❌ No chunks available');
                return res.status(404).json({
                    error: 'No chunks available',
                    message: `No document chunks found for "${documentSlug}". The document may not be processed yet.`
                });
            }
            
            debugLog(`   Retrieved ${randomChunks.length} chunks`);
            
            // Convert chunks to AI format
            console.log('🔄 Converting chunks to AI format...');
            const chunksForAI = convertDbChunksToAIFormat(randomChunks);
            console.log(`✅ Converted ${chunksForAI.length} chunks`);
            
            // Generate questions using OpenAI
            if (!openaiClient) {
                console.log('❌ OpenAI client not available');
                return res.status(503).json({
                    error: 'OpenAI client not available',
                    message: 'Quiz generation requires OpenAI API key'
                });
            }
            
            debugLog(`   Generating ${questionCount} questions...`);
            console.log(`🤖 Generating ${questionCount} questions with OpenAI...`);
            const questions = await generateQuizQuestions(
                openaiClient,
                chunksForAI,
                docInfo.title || documentSlug,
                questionCount
            );
            
            if (!questions || questions.length === 0) {
                console.log('❌ Failed to generate questions');
                return res.status(500).json({
                    error: 'Failed to generate questions',
                    message: 'Unable to generate quiz questions. Please try again later.'
                });
            }
            
            console.log(`✅ Generated ${questions.length} questions`);
            const elapsed = Date.now() - startTime;
            debugLog(`   ✓ Quiz generated successfully in ${(elapsed / 1000).toFixed(1)}s`);
            
            // Return quiz data
            return res.json({
                questions,
                documentSlug,
                documentTitle: docInfo.title || documentSlug,
                generatedAt: new Date().toISOString(),
                numQuestions: questions.length
            });
            
        } catch (error) {
            console.error('❌ Quiz generation error:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            const elapsed = Date.now() - startTime;
            
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message || 'An error occurred while generating the quiz',
                elapsed: `${(elapsed / 1000).toFixed(1)}s`,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
    
    return router;
}

module.exports = {
    createQuizRouter
};

