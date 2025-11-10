/**
 * Quiz Operations
 * Database operations for quiz storage and retrieval
 */

const { DatabaseError } = require('../errors/processing-errors');
const { validateSupabaseClient, validateDocumentSlug } = require('../utils/input-validator');

/**
 * Create a new quiz record
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {number} bankSize - Number of questions in the question bank
 * @param {string|null} generatedBy - User ID who generated the quiz
 * @param {number} quizSize - Number of questions per quiz attempt (default: 10)
 * @returns {Promise<Object>} Created quiz record
 */
async function createQuiz(supabase, documentSlug, bankSize, generatedBy = null, quizSize = 10) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!Number.isInteger(bankSize) || bankSize < 1) {
        throw new Error('bankSize must be a positive integer');
    }
    
    if (!Number.isInteger(quizSize) || quizSize < 1) {
        throw new Error('quizSize must be a positive integer');
    }
    
    const { data, error } = await supabase
        .from('quizzes')
        .insert({
            document_slug: documentSlug,
            bank_size: bankSize,
            quiz_size: quizSize,
            generated_by: generatedBy,
            status: 'generating'
        })
        .select()
        .single();
    
    if (error) {
        // If quiz already exists, update it instead
        if (error.code === '23505') { // Unique violation
            const { data: updated, error: updateError } = await supabase
                .from('quizzes')
                .update({
                    bank_size: bankSize,
                    quiz_size: quizSize,
                    generated_by: generatedBy,
                    status: 'generating',
                    generated_at: new Date().toISOString()
                })
                .eq('document_slug', documentSlug)
                .select()
                .single();
            
            if (updateError) {
                throw new DatabaseError(
                    `Failed to update quiz: ${updateError.message}`,
                    { documentSlug, errorCode: updateError.code }
                );
            }
            return updated;
        }
        
        throw new DatabaseError(
            `Failed to create quiz: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data;
}

/**
 * Store quiz questions for a document (question bank)
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {Array} questions - Array of question objects with question, options, correctAnswer
 * @returns {Promise<Array>} Array of created question records
 */
async function storeQuizQuestions(supabase, documentSlug, questions) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('questions must be a non-empty array');
    }
    
    // Validate and format questions
    const questionsToInsert = questions.map((q, index) => {
        if (!q.question || typeof q.question !== 'string') {
            throw new Error(`Question ${index + 1} missing or invalid question text`);
        }
        if (!Array.isArray(q.options) || q.options.length !== 5) {
            throw new Error(`Question ${index + 1} must have exactly 5 options`);
        }
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 4) {
            throw new Error(`Question ${index + 1} correctAnswer must be 0-4`);
        }
        
        return {
            document_slug: documentSlug,
            question: q.question.trim(),
            options: q.options.map(opt => String(opt).trim()),
            correct_answer: q.correctAnswer
        };
    });
    
    // Delete existing questions first (in case of regeneration)
    const { error: deleteError } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('document_slug', documentSlug);
    
    if (deleteError) {
        throw new DatabaseError(
            `Failed to delete existing questions: ${deleteError.message}`,
            { documentSlug, errorCode: deleteError.code }
        );
    }
    
    // Insert new questions
    const { data, error } = await supabase
        .from('quiz_questions')
        .insert(questionsToInsert)
        .select();
    
    if (error) {
        throw new DatabaseError(
            `Failed to store quiz questions: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data || [];
}

/**
 * Get quiz by document slug
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<Object|null>} Quiz record or null if not found
 */
async function getQuizByDocumentSlug(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('document_slug', documentSlug)
        .eq('status', 'completed')
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        throw new DatabaseError(
            `Failed to get quiz: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data;
}

/**
 * Get all questions from the question bank for a document
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<Array>} Array of all question records in the bank
 */
async function getQuizQuestions(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('document_slug', documentSlug);
    
    if (error) {
        throw new DatabaseError(
            `Failed to get quiz questions: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data || [];
}

/**
 * Get random questions from the question bank for a quiz attempt
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {number} quizSize - Number of questions to select (default: 10)
 * @returns {Promise<Array>} Array of randomly selected question records
 */
async function getRandomQuizQuestions(supabase, documentSlug, quizSize = 10) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!Number.isInteger(quizSize) || quizSize < 1) {
        throw new Error('quizSize must be a positive integer');
    }
    
    // Get all questions from the bank
    const allQuestions = await getQuizQuestions(supabase, documentSlug);
    
    if (allQuestions.length === 0) {
        return [];
    }
    
    // If we have fewer questions than requested, return all
    if (allQuestions.length <= quizSize) {
        return allQuestions;
    }
    
    // Randomly select quizSize questions
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, quizSize);
}

/**
 * Check if quiz can be regenerated (7 days must have passed)
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<Object>} Object with canRegenerate (boolean) and nextAllowedDate (Date|null)
 */
async function canRegenerateQuiz(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { data, error } = await supabase
        .from('quizzes')
        .select('generated_at')
        .eq('document_slug', documentSlug)
        .single();
    
    if (error || !data) {
        // No existing quiz, can generate
        return {
            canRegenerate: true,
            lastGenerated: null,
            nextAllowedDate: null
        };
    }
    
    const lastGenerated = new Date(data.generated_at);
    const now = new Date();
    const daysSinceGeneration = (now - lastGenerated) / (1000 * 60 * 60 * 24);
    const canRegenerate = daysSinceGeneration >= 7;
    
    const nextAllowedDate = canRegenerate ? null : new Date(lastGenerated.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return {
        canRegenerate,
        lastGenerated,
        nextAllowedDate
    };
}

/**
 * Update quiz status (for regeneration tracking)
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {string} status - Status ('generating', 'completed', 'failed')
 * @returns {Promise<Object>} Updated quiz record
 */
async function updateQuizStatus(supabase, documentSlug, status) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!['generating', 'completed', 'failed'].includes(status)) {
        throw new Error('status must be one of: generating, completed, failed');
    }
    
    const { data, error } = await supabase
        .from('quizzes')
        .update({ status })
        .eq('document_slug', documentSlug)
        .select()
        .single();
    
    if (error) {
        throw new DatabaseError(
            `Failed to update quiz status: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data;
}

/**
 * Create a quiz attempt record
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {string|null} userId - User ID (nullable for anonymous)
 * @param {number} score - Number of correct answers
 * @param {number} totalQuestions - Total number of questions
 * @param {Array<string>} questionIds - Array of question IDs used in this attempt
 * @returns {Promise<Object>} Created attempt record
 */
async function createQuizAttempt(supabase, documentSlug, userId, score, totalQuestions, questionIds = null) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!Number.isInteger(score) || score < 0) {
        throw new Error('score must be a non-negative integer');
    }
    
    if (!Number.isInteger(totalQuestions) || totalQuestions < 1) {
        throw new Error('totalQuestions must be a positive integer');
    }
    
    if (questionIds !== null && (!Array.isArray(questionIds) || questionIds.length !== totalQuestions)) {
        throw new Error('questionIds must be an array with length matching totalQuestions');
    }
    
    const { data, error } = await supabase
        .from('quiz_attempts')
        .insert({
            document_slug: documentSlug,
            user_id: userId,
            score,
            total_questions: totalQuestions,
            question_ids: questionIds,
            completed_at: new Date().toISOString()
        })
        .select()
        .single();
    
    if (error) {
        throw new DatabaseError(
            `Failed to create quiz attempt: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data;
}

/**
 * Get quiz attempts for a document and optionally a user
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {string|null} userId - User ID (nullable for anonymous, optional filter)
 * @returns {Promise<Array>} Array of attempt records
 */
async function getQuizAttempts(supabase, documentSlug, userId = null) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    let query = supabase
        .from('quiz_attempts')
        .select('*')
        .eq('document_slug', documentSlug)
        .order('completed_at', { ascending: false });
    
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
        throw new DatabaseError(
            `Failed to get quiz attempts: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data || [];
}

/**
 * Update documents.quizzes_generated flag
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {boolean} generated - Whether quizzes are generated
 * @returns {Promise<void>}
 */
async function updateDocumentQuizzesGenerated(supabase, documentSlug, generated) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { error } = await supabase
        .from('documents')
        .update({ quizzes_generated: generated })
        .eq('slug', documentSlug);
    
    if (error) {
        throw new DatabaseError(
            `Failed to update quizzes_generated flag: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
}

/**
 * Get quiz statistics for a document
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<Object>} Statistics object with totalAttempts, averageScore, etc.
 */
async function getQuizStatistics(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    // Get all attempts for this document
    const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('score, total_questions, completed_at, user_id')
        .eq('document_slug', documentSlug);
    
    if (error) {
        throw new DatabaseError(
            `Failed to get quiz statistics: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    if (!attempts || attempts.length === 0) {
        return {
            totalAttempts: 0,
            authenticatedAttempts: 0,
            anonymousAttempts: 0,
            averageScore: 0,
            averagePercentage: 0,
            highestScore: 0,
            lowestScore: 0,
            totalQuestions: 0
        };
    }
    
    const authenticatedAttempts = attempts.filter(a => a.user_id !== null).length;
    const anonymousAttempts = attempts.filter(a => a.user_id === null).length;
    const scores = attempts.map(a => a.score);
    const percentages = attempts.map(a => (a.score / a.total_questions) * 100);
    const totalQuestions = attempts[0]?.total_questions || 0;
    
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const averagePercentage = percentages.reduce((sum, pct) => sum + pct, 0) / percentages.length;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    
    return {
        totalAttempts: attempts.length,
        authenticatedAttempts,
        anonymousAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        highestScore,
        lowestScore,
        totalQuestions
    };
}

module.exports = {
    createQuiz,
    storeQuizQuestions,
    getQuizByDocumentSlug,
    getQuizQuestions,
    getRandomQuizQuestions,
    canRegenerateQuiz,
    updateQuizStatus,
    createQuizAttempt,
    getQuizAttempts,
    updateDocumentQuizzesGenerated,
    getQuizStatistics
};

