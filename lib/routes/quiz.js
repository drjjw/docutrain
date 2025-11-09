/**
 * Quiz routes
 * Handles quiz generation endpoint
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { authenticateUser, checkDocumentAccess } = require('./chat-helpers');
const { getRandomChunks, convertDbChunksToAIFormat, getChunkCount } = require('../db/chunk-operations');
const { generateQuizQuestions } = require('../processors/quiz-generator');
const {
    createQuiz,
    storeQuizQuestions,
    getQuizByDocumentSlug,
    getQuizQuestions,
    canRegenerateQuiz,
    updateQuizStatus,
    createQuizAttempt,
    updateDocumentQuizzesGenerated
} = require('../db/quiz-operations');
const { debugLog } = require('../utils/debug');
const processingLogger = require('../processing-logger');

/**
 * Check if user is a super admin
 * @param {string} userId - User ID
 * @param {Object} adminSupabase - Admin Supabase client
 * @returns {Promise<boolean>} True if user is super admin
 */
async function isSuperAdmin(userId, adminSupabase) {
    if (!userId || !adminSupabase) {
        return false;
    }
    
    try {
        const { data: permissions, error } = await adminSupabase
            .from('user_permissions_summary')
            .select('*')
            .eq('user_id', userId);
        
        if (error) {
            debugLog('Failed to check super admin status:', error);
            return false;
        }
        
        return permissions?.some(p => p.role === 'super_admin') || false;
    } catch (error) {
        debugLog('Error checking super admin status:', error);
        return false;
    }
}

/**
 * Create quiz router
 */
function createQuizRouter(dependencies) {
    const {
        supabase,
        openaiClient,
        documentRegistry
    } = dependencies;
    
    // Create admin client for permission checks
    const adminSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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

    /**
     * POST /api/quiz/generate-and-store
     * Generate quiz questions and store them in database
     */
    router.post('/generate-and-store', async (req, res) => {
        const startTime = Date.now();
        
        try {
            console.log('📝 Quiz generation and storage request received');
            
            const { documentSlug, numQuestions } = req.body;
            
            if (!documentSlug) {
                return res.status(400).json({
                    error: 'documentSlug is required'
                });
            }
            
            debugLog('📝 Quiz generation and storage request');
            debugLog(`   Document: ${documentSlug}`);
            
            // Authenticate user first
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            
            // Log quiz generation start
            await processingLogger.started(supabase, documentSlug, processingLogger.STAGES.QUIZ, 
                'Starting quiz generation', { documentSlug, userId });
            
            // Check document access
            const accessResult = await checkDocumentAccess([documentSlug], userId, supabase, null);
            if (!accessResult.hasAccess) {
                return res.status(accessResult.error.status).json({
                    error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                    message: accessResult.error.message
                });
            }
            
            // Check if user is super admin (super admins bypass regeneration limit)
            const userIsSuperAdmin = await isSuperAdmin(userId, adminSupabase);
            
            // Check if regeneration is allowed (7 days must have passed, unless super admin)
            if (!userIsSuperAdmin) {
                const regenerationCheck = await canRegenerateQuiz(supabase, documentSlug);
                if (!regenerationCheck.canRegenerate) {
                    const lastGenerated = regenerationCheck.lastGenerated;
                    const nextAllowed = regenerationCheck.nextAllowedDate;
                    return res.status(429).json({
                        error: 'Regeneration limit exceeded',
                        message: `Quizzes can only be regenerated once per week. Last generated: ${lastGenerated.toISOString()}. Next allowed: ${nextAllowed.toISOString()}`,
                        lastGenerated: lastGenerated.toISOString(),
                        nextAllowedDate: nextAllowed.toISOString()
                    });
                }
            } else {
                debugLog('   Super admin detected - bypassing regeneration limit');
            }
            
            // Get document info from registry
            const docInfo = await documentRegistry.getDocumentBySlug(documentSlug);
            if (!docInfo) {
                return res.status(404).json({
                    error: 'Document not found',
                    message: `Document "${documentSlug}" not found in registry`
                });
            }
            
            // Calculate number of questions based on chunk count if not provided
            let questionCount = numQuestions;
            if (!questionCount) {
                const chunkCount = await getChunkCount(supabase, documentSlug);
                // Formula: 1 question per 2 chunks, min 10, max 100
                questionCount = Math.min(Math.max(Math.floor(chunkCount / 2), 10), 100);
                debugLog(`   Calculated ${questionCount} questions from ${chunkCount} chunks`);
                await processingLogger.progress(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS, 
                    `Calculated ${questionCount} questions from ${chunkCount} chunks`, { chunkCount, questionCount });
            } else {
                const parsedCount = parseInt(questionCount, 10);
                if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 100) {
                    return res.status(400).json({
                        error: 'numQuestions must be between 1 and 100'
                    });
                }
                questionCount = parsedCount;
            }
            
            // Get random chunks (need enough chunks for good question generation)
            const chunksNeeded = Math.max(questionCount * 2, 10);
            debugLog(`   Fetching ${chunksNeeded} random chunks...`);
            
            await processingLogger.progress(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                `Fetching ${chunksNeeded} random chunks for question generation`, { chunksNeeded, questionCount });
            
            const randomChunks = await getRandomChunks(supabase, documentSlug, chunksNeeded);
            
            if (!randomChunks || randomChunks.length === 0) {
                await processingLogger.failed(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ,
                    'No chunks available for quiz generation', { documentSlug });
                return res.status(404).json({
                    error: 'No chunks available',
                    message: `No document chunks found for "${documentSlug}". The document may not be processed yet.`
                });
            }
            
            await processingLogger.progress(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                `Retrieved ${randomChunks.length} chunks`, { chunksRetrieved: randomChunks.length });
            
            // Convert chunks to AI format
            const chunksForAI = convertDbChunksToAIFormat(randomChunks);
            
            // Generate questions using OpenAI
            if (!openaiClient) {
                await processingLogger.failed(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ,
                    'OpenAI client not available', { documentSlug });
                return res.status(503).json({
                    error: 'OpenAI client not available',
                    message: 'Quiz generation requires OpenAI API key'
                });
            }
            
            // Create quiz record with 'generating' status
            const quiz = await createQuiz(supabase, documentSlug, questionCount, userId);
            const quizId = quiz.id;
            
            await processingLogger.progress(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                `Created quiz record`, { quizId, questionCount });
            
            try {
                debugLog(`   Generating ${questionCount} questions...`);
                await processingLogger.progress(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                    `Generating ${questionCount} questions using OpenAI`, { questionCount, quizId });
                
                const questions = await generateQuizQuestions(
                    openaiClient,
                    chunksForAI,
                    docInfo.title || documentSlug,
                    questionCount
                );
                
                if (!questions || questions.length === 0) {
                    // Update quiz status to failed
                    await updateQuizStatus(supabase, quizId, 'failed');
                    await processingLogger.failed(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ,
                        'Failed to generate questions from OpenAI', { quizId, questionCount });
                    return res.status(500).json({
                        error: 'Failed to generate questions',
                        message: 'Unable to generate quiz questions. Please try again later.'
                    });
                }
                
                await processingLogger.progress(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                    `Generated ${questions.length} questions successfully`, { questionsGenerated: questions.length, quizId });
                
                // Store questions in database
                await storeQuizQuestions(supabase, quizId, questions);
                
                await processingLogger.progress(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                    `Stored ${questions.length} questions in database`, { questionsStored: questions.length, quizId });
                
                // Update quiz status to completed
                await updateQuizStatus(supabase, quizId, 'completed');
                
                // Update documents.quizzes_generated flag
                await updateDocumentQuizzesGenerated(supabase, documentSlug, true);
                
                const elapsed = Date.now() - startTime;
                debugLog(`   ✓ Quiz generated and stored successfully in ${(elapsed / 1000).toFixed(1)}s`);
                
                await processingLogger.completed(supabase, documentSlug, documentSlug, processingLogger.STAGES.QUIZ,
                    `Quiz generation completed successfully`, { 
                        quizId, 
                        questionCount: questions.length, 
                        processingTimeMs: elapsed,
                        documentSlug 
                    });
                
                return res.json({
                    success: true,
                    quizId,
                    documentSlug,
                    numQuestions: questions.length,
                    generatedAt: new Date().toISOString(),
                    message: 'Quiz generated and stored successfully'
                });
                
            } catch (error) {
                // Update quiz status to failed
                await updateQuizStatus(supabase, quizId, 'failed');
                await processingLogger.error(supabase, documentSlug, documentSlug,
                    'Quiz generation failed', error, { quizId, questionCount });
                throw error;
            }
            
        } catch (error) {
            console.error('❌ Quiz generation and storage error:', error);
            const elapsed = Date.now() - startTime;
            
            // Log error if we have documentSlug
            if (documentSlug) {
                await processingLogger.error(supabase, documentSlug, documentSlug,
                    'Quiz generation error', error, { elapsed });
            }
            
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message || 'An error occurred while generating and storing the quiz',
                elapsed: `${(elapsed / 1000).toFixed(1)}s`,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

    /**
     * GET /api/quiz/:documentSlug
     * Retrieve stored quiz questions for a document
     */
    router.get('/:documentSlug', async (req, res) => {
        try {
            const { documentSlug } = req.params;
            
            if (!documentSlug) {
                return res.status(400).json({
                    error: 'documentSlug is required'
                });
            }
            
            debugLog(`📖 Retrieving quiz for document: ${documentSlug}`);
            
            // Authenticate user (optional for reading quizzes)
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            
            // Check document access
            const accessResult = await checkDocumentAccess([documentSlug], userId, supabase, null);
            if (!accessResult.hasAccess) {
                return res.status(accessResult.error.status).json({
                    error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                    message: accessResult.error.message
                });
            }
            
            // Get quiz metadata
            const quiz = await getQuizByDocumentSlug(supabase, documentSlug);
            if (!quiz) {
                return res.status(404).json({
                    error: 'Quiz not found',
                    message: `No quiz found for document "${documentSlug}". Please generate quizzes first.`
                });
            }
            
            // Get quiz questions
            const questions = await getQuizQuestions(supabase, quiz.id);
            
            if (!questions || questions.length === 0) {
                return res.status(404).json({
                    error: 'Quiz questions not found',
                    message: `No questions found for quiz "${quiz.id}"`
                });
            }
            
            // Format questions for frontend
            const formattedQuestions = questions.map(q => ({
                question: q.question,
                options: q.options,
                correctAnswer: q.correct_answer
            }));
            
            // Get document info
            const docInfo = await documentRegistry.getDocumentBySlug(documentSlug);
            
            return res.json({
                quizId: quiz.id,
                questions: formattedQuestions,
                documentSlug,
                documentTitle: docInfo?.title || documentSlug,
                numQuestions: formattedQuestions.length,
                generatedAt: quiz.generated_at
            });
            
        } catch (error) {
            console.error('❌ Quiz retrieval error:', error);
            
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message || 'An error occurred while retrieving the quiz',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

    /**
     * POST /api/quiz/attempt
     * Record a quiz attempt with score
     */
    router.post('/attempt', async (req, res) => {
        try {
            const { quizId, answers, score } = req.body;
            
            if (!quizId) {
                return res.status(400).json({
                    error: 'quizId is required'
                });
            }
            
            if (typeof score !== 'number' || score < 0) {
                return res.status(400).json({
                    error: 'score must be a non-negative number'
                });
            }
            
            // Authenticate user (optional - allow anonymous attempts)
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            
            // Get quiz to validate and get total questions
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('num_questions, document_slug')
                .eq('id', quizId)
                .single();
            
            if (quizError || !quiz) {
                return res.status(404).json({
                    error: 'Quiz not found',
                    message: `Quiz "${quizId}" not found`
                });
            }
            
            // Validate score doesn't exceed total questions
            if (score > quiz.num_questions) {
                return res.status(400).json({
                    error: 'Invalid score',
                    message: `Score (${score}) cannot exceed total questions (${quiz.num_questions})`
                });
            }
            
            // Check document access
            const accessResult = await checkDocumentAccess([quiz.document_slug], userId, supabase, null);
            if (!accessResult.hasAccess) {
                return res.status(accessResult.error.status).json({
                    error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                    message: accessResult.error.message
                });
            }
            
            // Create attempt record
            const attempt = await createQuizAttempt(
                supabase,
                quizId,
                userId,
                score,
                quiz.num_questions
            );
            
            debugLog(`✓ Quiz attempt recorded: ${score}/${quiz.num_questions} for quiz ${quizId}`);
            
            return res.json({
                success: true,
                attemptId: attempt.id,
                score,
                totalQuestions: quiz.num_questions,
                completedAt: attempt.completed_at
            });
            
        } catch (error) {
            console.error('❌ Quiz attempt error:', error);
            
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message || 'An error occurred while recording the quiz attempt',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
    
    return router;
}

module.exports = {
    createQuizRouter
};

