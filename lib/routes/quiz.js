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
    getRandomQuizQuestions,
    canRegenerateQuiz,
    updateQuizStatus,
    createQuizAttempt,
    updateDocumentQuizzesGenerated,
    getQuizStatistics
} = require('../db/quiz-operations');
const { checkDocumentPermissions } = require('../utils/documents-access');
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
            
            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to generate quizzes'
                });
            }
            
            // Log quiz generation start (quiz logs don't have a user_document_id, so pass null)
            await processingLogger.started(supabase, null, processingLogger.STAGES.QUIZ, 
                'Starting quiz generation', { documentSlug, userId }, 'vps');
            
            // Check if user has admin permissions (super admin or owner admin)
            // Admins can generate quizzes regardless of document access restrictions (passcode, etc.)
            const adminPermissions = await checkDocumentPermissions(userId, documentSlug, adminSupabase);
            
            if (adminPermissions.isSuperAdmin || adminPermissions.isOwnerAdmin) {
                // Admin user - bypass access restrictions, just verify document exists
                debugLog(`   Admin user detected (super: ${adminPermissions.isSuperAdmin}, owner: ${adminPermissions.isOwnerAdmin}) - bypassing access restrictions`);
                
                if (!adminPermissions.doc) {
                    return res.status(404).json({
                        error: 'Document not found',
                        message: `Document "${documentSlug}" not found`
                    });
                }
            } else {
                // Non-admin user - check document access normally (respects passcode, etc.)
                const accessResult = await checkDocumentAccess([documentSlug], userId, supabase, null);
                if (!accessResult.hasAccess) {
                    return res.status(accessResult.error.status).json({
                        error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                        message: accessResult.error.message
                    });
                }
            }
            
            // Check if user is super admin or owner admin (both bypass regeneration limit)
            const userIsSuperAdmin = adminPermissions.isSuperAdmin || await isSuperAdmin(userId, adminSupabase);
            const userIsOwnerAdmin = adminPermissions.isOwnerAdmin;
            
            // Check if regeneration is allowed (7 days must have passed, unless admin)
            if (!userIsSuperAdmin && !userIsOwnerAdmin) {
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
                debugLog(`   Admin user detected (super: ${userIsSuperAdmin}, owner: ${userIsOwnerAdmin}) - bypassing regeneration limit`);
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
                await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, 
                    `Calculated ${questionCount} questions from ${chunkCount} chunks`, { chunkCount, questionCount }, 'vps');
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
            
            await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                `Fetching ${chunksNeeded} random chunks for question generation`, { chunksNeeded, questionCount }, 'vps');
            
            const randomChunks = await getRandomChunks(supabase, documentSlug, chunksNeeded);
            
            if (!randomChunks || randomChunks.length === 0) {
                await processingLogger.failed(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                    'No chunks available for quiz generation', { documentSlug }, 'vps');
                return res.status(404).json({
                    error: 'No chunks available',
                    message: `No document chunks found for "${documentSlug}". The document may not be processed yet.`
                });
            }
            
            await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                `Retrieved ${randomChunks.length} chunks`, { chunksRetrieved: randomChunks.length }, 'vps');
            
            // Convert chunks to AI format
            const chunksForAI = convertDbChunksToAIFormat(randomChunks);
            
            // Generate questions using OpenAI
            if (!openaiClient) {
                await processingLogger.failed(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                    'OpenAI client not available', { documentSlug }, 'vps');
                return res.status(503).json({
                    error: 'OpenAI client not available',
                    message: 'Quiz generation requires OpenAI API key'
                });
            }
            
            // Create quiz record with 'generating' status (for regeneration tracking)
            // questionCount = bank_size (total questions in bank)
            // quiz_size = 5 (questions per attempt, default)
            const quizSize = 5; // Default quiz size per attempt
            const quiz = await createQuiz(supabase, documentSlug, questionCount, userId, quizSize);
            
            await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                `Created quiz metadata record`, { questionCount }, 'vps');
            
            try {
                debugLog(`   Generating ${questionCount} questions...`);
                
                // Log if batching will be used (for questionCount > 20)
                if (questionCount > 20) {
                    const numBatches = Math.ceil(questionCount / 20);
                    debugLog(`   Using batched generation: ${numBatches} batches of ~20 questions each`);
                    await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                        `Generating ${questionCount} questions in ${numBatches} batches using OpenAI`, { questionCount, batches: numBatches }, 'vps');
                } else {
                    await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                        `Generating ${questionCount} questions using OpenAI`, { questionCount }, 'vps');
                }
                
                let questions;
                try {
                    questions = await generateQuizQuestions(
                        openaiClient,
                        chunksForAI,
                        docInfo.title || documentSlug,
                        questionCount,
                        {
                            processingLogger,
                            supabase,
                            documentSlug
                        }
                    );
                } catch (genError) {
                    // Update quiz status to failed
                    await updateQuizStatus(supabase, documentSlug, 'failed');
                    
                    // Get more detailed error info
                    let errorMessage = genError.message || 'Unable to generate quiz questions. Please try again later.';
                    if (questionCount > 50) {
                        errorMessage = `Failed to generate ${questionCount} questions: ${genError.message}. Large question sets may timeout. Try generating fewer questions (50 or less) or try again later.`;
                    } else if (genError.message && genError.message.includes('timeout')) {
                        errorMessage = `Quiz generation timed out. ${questionCount > 25 ? 'Try generating fewer questions (25 or less) or ' : ''}try again later.`;
                    }
                    
                    await processingLogger.failed(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                        `Failed to generate questions from OpenAI: ${genError.message}`, { questionCount }, 'vps');
                    return res.status(500).json({
                        error: 'Failed to generate questions',
                        message: errorMessage
                    });
                }
                
                if (!questions || questions.length === 0) {
                    // Update quiz status to failed
                    await updateQuizStatus(supabase, documentSlug, 'failed');
                    
                    // Get more detailed error info if available
                    let errorMessage = 'Unable to generate quiz questions. Please try again later.';
                    if (questionCount > 50) {
                        errorMessage = `Failed to generate ${questionCount} questions. Large question sets may timeout. Try generating fewer questions (50 or less) or try again later.`;
                    }
                    
                    await processingLogger.failed(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                        'Failed to generate questions from OpenAI', { questionCount }, 'vps');
                    return res.status(500).json({
                        error: 'Failed to generate questions',
                        message: errorMessage
                    });
                }
                
                await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                    `Generated ${questions.length} questions successfully`, { questionsGenerated: questions.length }, 'vps');
                
                // Store questions in database directly with document_slug
                await storeQuizQuestions(supabase, documentSlug, questions);
                
                await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                    `Stored ${questions.length} questions in database`, { questionsStored: questions.length }, 'vps');
                
                // Update quiz status to completed
                await updateQuizStatus(supabase, documentSlug, 'completed');
                
                // Update documents.quizzes_generated flag
                await updateDocumentQuizzesGenerated(supabase, documentSlug, true);
                
                const elapsed = Date.now() - startTime;
                debugLog(`   ✓ Quiz generated and stored successfully in ${(elapsed / 1000).toFixed(1)}s`);
                
                await processingLogger.completed(supabase, null, documentSlug, processingLogger.STAGES.QUIZ,
                    `Quiz generation completed successfully`, { 
                        questionCount: questions.length, 
                        processingTimeMs: elapsed,
                        documentSlug 
                    });
                
                return res.json({
                    success: true,
                    documentSlug,
                    numQuestions: questions.length,
                    generatedAt: new Date().toISOString(),
                    message: 'Quiz generated and stored successfully'
                });
                
            } catch (error) {
                // Update quiz status to failed
                await updateQuizStatus(supabase, documentSlug, 'failed');
                await processingLogger.error(supabase, documentSlug, documentSlug,
                    'Quiz generation failed', error, { questionCount });
                throw error;
            }
            
        } catch (error) {
            console.error('❌ Quiz generation and storage error:', error);
            const elapsed = Date.now() - startTime;
            
            // Log error if we have documentSlug (use the one from req.body since it's in scope)
            const errorDocumentSlug = req.body?.documentSlug || documentSlug;
            if (errorDocumentSlug) {
                await processingLogger.error(supabase, errorDocumentSlug, errorDocumentSlug,
                    'Quiz generation error', error, { elapsed }, 'vps');
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
            
            // Check if user has admin permissions (super admin or owner admin)
            // Admins can access quizzes regardless of document access restrictions (passcode, etc.)
            const adminPermissions = await checkDocumentPermissions(userId, documentSlug, adminSupabase);
            
            if (adminPermissions.isSuperAdmin || adminPermissions.isOwnerAdmin) {
                // Admin user - bypass access restrictions, just verify document exists
                debugLog(`   Admin user detected (super: ${adminPermissions.isSuperAdmin}, owner: ${adminPermissions.isOwnerAdmin}) - bypassing access restrictions`);
                
                if (!adminPermissions.doc) {
                    return res.status(404).json({
                        error: 'Document not found',
                        message: `Document "${documentSlug}" not found`
                    });
                }
            } else {
                // Non-admin user - check document access normally (respects passcode, etc.)
                const accessResult = await checkDocumentAccess([documentSlug], userId, supabase, null);
                if (!accessResult.hasAccess) {
                    return res.status(accessResult.error.status).json({
                        error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                        message: accessResult.error.message
                    });
                }
            }
            
            // Check if questions exist for this document
            const allQuestions = await getQuizQuestions(supabase, documentSlug);
            if (!allQuestions || allQuestions.length === 0) {
                return res.status(404).json({
                    error: 'Quiz questions not found',
                    message: `No questions found for document "${documentSlug}". Please generate questions first.`
                });
            }
            
            // For admins, return ALL questions from the bank
            // For regular users, return random sample (quiz_size questions per attempt)
            let questions;
            let questionIds;
            const isAdmin = adminPermissions.isSuperAdmin || adminPermissions.isOwnerAdmin;
            
            if (isAdmin) {
                // Admin: return all questions from the bank
                questions = allQuestions;
                debugLog(`   Admin user - returning all ${questions.length} questions from bank`);
            } else {
                // Regular user: return random sample
                const quizSize = 5; // Default quiz size per attempt
                questions = await getRandomQuizQuestions(supabase, documentSlug, quizSize);
                debugLog(`   Regular user - returning ${questions.length} random questions`);
            }
            
            if (!questions || questions.length === 0) {
                return res.status(404).json({
                    error: 'Quiz questions not found',
                    message: `No questions found for document "${documentSlug}"`
                });
            }
            
            // Format questions for frontend and collect question IDs
            const formattedQuestions = questions.map(q => ({
                id: q.id, // Include question ID for tracking
                question: q.question,
                options: q.options,
                correctAnswer: q.correct_answer
            }));
            
            // Extract question IDs for storing in attempt
            questionIds = formattedQuestions.map(q => q.id);
            
            // Get document info
            const docInfo = await documentRegistry.getDocumentBySlug(documentSlug);
            
            // Get quiz metadata for bank size and generation date (optional)
            const quiz = await getQuizByDocumentSlug(supabase, documentSlug);
            
            return res.json({
                questions: formattedQuestions,
                questionIds, // Include question IDs so frontend can send them back with attempt
                documentSlug,
                documentTitle: docInfo?.title || documentSlug,
                numQuestions: formattedQuestions.length,
                quizSize: isAdmin ? null : (quiz?.quiz_size || 5), // Only include quizSize for regular users
                bankSize: allQuestions.length, // Total questions in bank
                generatedAt: quiz?.generated_at || null
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
            const { documentSlug, answers, score, questionIds } = req.body;
            
            if (!documentSlug) {
                return res.status(400).json({
                    error: 'documentSlug is required'
                });
            }
            
            if (typeof score !== 'number' || score < 0) {
                return res.status(400).json({
                    error: 'score must be a non-negative number'
                });
            }
            
            // Authenticate user (optional - allow anonymous attempts)
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            
            // Validate document exists
            const { data: doc, error: docError } = await supabase
                .from('documents')
                .select('slug')
                .eq('slug', documentSlug)
                .single();
            
            if (docError || !doc) {
                debugLog(`Quiz attempt failed: Document ${documentSlug} not found`, { 
                    docError: docError?.message, 
                    code: docError?.code,
                    userId: userId || 'anonymous'
                });
                
                return res.status(404).json({
                    error: 'Document not found',
                    message: `Document "${documentSlug}" not found. Please reload the quiz and try again.`
                });
            }
            
            // Determine quiz size from questionIds or default to 5
            const quizSize = questionIds && Array.isArray(questionIds) ? questionIds.length : 5;
            
            // Validate score doesn't exceed quiz size
            if (score > quizSize) {
                return res.status(400).json({
                    error: 'Invalid score',
                    message: `Score (${score}) cannot exceed quiz size (${quizSize})`
                });
            }
            
            // Validate questionIds if provided
            if (questionIds && (!Array.isArray(questionIds) || questionIds.length !== quizSize)) {
                return res.status(400).json({
                    error: 'Invalid questionIds',
                    message: `questionIds must be an array with ${quizSize} question IDs`
                });
            }
            
            // Check document access
            const accessResult = await checkDocumentAccess([documentSlug], userId, supabase, null);
            if (!accessResult.hasAccess) {
                return res.status(accessResult.error.status).json({
                    error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                    message: accessResult.error.message
                });
            }
            
            // Create attempt record with question IDs
            const attempt = await createQuizAttempt(
                supabase,
                documentSlug,
                userId,
                score,
                quizSize,
                questionIds || null // Store question IDs if provided
            );
            
            debugLog(`✓ Quiz attempt recorded: ${score}/${quizSize} for document ${documentSlug}${questionIds ? ` (${questionIds.length} questions)` : ''}`);
            
            return res.json({
                success: true,
                attemptId: attempt.id,
                score,
                totalQuestions: quizSize,
                questionIds: questionIds || null,
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

    /**
     * GET /api/quiz/:documentSlug/statistics
     * Get quiz statistics for a document
     */
    router.get('/:documentSlug/statistics', async (req, res) => {
        try {
            const { documentSlug } = req.params;
            
            if (!documentSlug) {
                return res.status(400).json({
                    error: 'documentSlug is required'
                });
            }
            
            debugLog(`📊 Retrieving quiz statistics for document: ${documentSlug}`);
            
            // Authenticate user (required for admin access)
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            
            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to view quiz statistics'
                });
            }
            
            // Check if user has admin permissions (super admin or owner admin)
            // Admins can access quiz statistics regardless of document access restrictions (passcode, etc.)
            const adminPermissions = await checkDocumentPermissions(userId, documentSlug, adminSupabase);
            
            if (adminPermissions.isSuperAdmin || adminPermissions.isOwnerAdmin) {
                // Admin user - bypass access restrictions, just verify document exists
                debugLog(`   Admin user detected (super: ${adminPermissions.isSuperAdmin}, owner: ${adminPermissions.isOwnerAdmin}) - bypassing access restrictions`);
                
                if (!adminPermissions.doc) {
                    return res.status(404).json({
                        error: 'Document not found',
                        message: `Document "${documentSlug}" not found`
                    });
                }
            } else {
                // Non-admin user - check document access normally (respects passcode, etc.)
                const accessResult = await checkDocumentAccess([documentSlug], userId, supabase, null);
                if (!accessResult.hasAccess) {
                    return res.status(accessResult.error.status).json({
                        error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                        message: accessResult.error.message
                    });
                }
            }
            
            // Check if questions exist for this document
            const questions = await getQuizQuestions(supabase, documentSlug);
            if (!questions || questions.length === 0) {
                return res.status(404).json({
                    error: 'Quiz questions not found',
                    message: `No questions found for document "${documentSlug}". Please generate questions first.`
                });
            }
            
            // Get quiz statistics
            const statistics = await getQuizStatistics(supabase, documentSlug);
            
            // Get quiz metadata for generation date (optional)
            const quiz = await getQuizByDocumentSlug(supabase, documentSlug);
            
            return res.json({
                documentSlug,
                numQuestions: questions.length, // Total questions in bank
                generatedAt: quiz?.generated_at || null,
                ...statistics
            });
            
        } catch (error) {
            console.error('❌ Quiz statistics error:', error);
            
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message || 'An error occurred while retrieving quiz statistics',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
    
    return router;
}

module.exports = {
    createQuizRouter
};

