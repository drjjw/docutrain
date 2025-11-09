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
 * @param {number} numQuestions - Number of questions
 * @param {string|null} generatedBy - User ID who generated the quiz
 * @returns {Promise<Object>} Created quiz record
 */
async function createQuiz(supabase, documentSlug, numQuestions, generatedBy = null) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!Number.isInteger(numQuestions) || numQuestions < 1) {
        throw new Error('numQuestions must be a positive integer');
    }
    
    const { data, error } = await supabase
        .from('quizzes')
        .insert({
            document_slug: documentSlug,
            num_questions: numQuestions,
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
                    num_questions: numQuestions,
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
 * Store quiz questions for a quiz
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} quizId - Quiz ID
 * @param {Array} questions - Array of question objects with question, options, correctAnswer
 * @returns {Promise<Array>} Array of created question records
 */
async function storeQuizQuestions(supabase, quizId, questions) {
    validateSupabaseClient(supabase);
    
    if (!quizId) {
        throw new Error('quizId is required');
    }
    
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('questions must be a non-empty array');
    }
    
    // Validate and format questions
    const questionsToInsert = questions.map((q, index) => {
        if (!q.question || typeof q.question !== 'string') {
            throw new Error(`Question ${index + 1} missing or invalid question text`);
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
            throw new Error(`Question ${index + 1} must have exactly 4 options`);
        }
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
            throw new Error(`Question ${index + 1} correctAnswer must be 0-3`);
        }
        
        return {
            quiz_id: quizId,
            question_index: index,
            question: q.question.trim(),
            options: q.options.map(opt => String(opt).trim()),
            correct_answer: q.correctAnswer
        };
    });
    
    // Delete existing questions first (in case of regeneration)
    const { error: deleteError } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('quiz_id', quizId);
    
    if (deleteError) {
        throw new DatabaseError(
            `Failed to delete existing questions: ${deleteError.message}`,
            { quizId, errorCode: deleteError.code }
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
            { quizId, errorCode: error.code }
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
 * Get all questions for a quiz
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} quizId - Quiz ID
 * @returns {Promise<Array>} Array of question records
 */
async function getQuizQuestions(supabase, quizId) {
    validateSupabaseClient(supabase);
    
    if (!quizId) {
        throw new Error('quizId is required');
    }
    
    const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('question_index', { ascending: true });
    
    if (error) {
        throw new DatabaseError(
            `Failed to get quiz questions: ${error.message}`,
            { quizId, errorCode: error.code }
        );
    }
    
    return data || [];
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
 * Update quiz status
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} quizId - Quiz ID
 * @param {string} status - Status ('generating', 'completed', 'failed')
 * @returns {Promise<Object>} Updated quiz record
 */
async function updateQuizStatus(supabase, quizId, status) {
    validateSupabaseClient(supabase);
    
    if (!['generating', 'completed', 'failed'].includes(status)) {
        throw new Error('status must be one of: generating, completed, failed');
    }
    
    const { data, error } = await supabase
        .from('quizzes')
        .update({ status })
        .eq('id', quizId)
        .select()
        .single();
    
    if (error) {
        throw new DatabaseError(
            `Failed to update quiz status: ${error.message}`,
            { quizId, errorCode: error.code }
        );
    }
    
    return data;
}

/**
 * Create a quiz attempt record
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} quizId - Quiz ID
 * @param {string|null} userId - User ID (nullable for anonymous)
 * @param {number} score - Number of correct answers
 * @param {number} totalQuestions - Total number of questions
 * @returns {Promise<Object>} Created attempt record
 */
async function createQuizAttempt(supabase, quizId, userId, score, totalQuestions) {
    validateSupabaseClient(supabase);
    
    if (!quizId) {
        throw new Error('quizId is required');
    }
    
    if (!Number.isInteger(score) || score < 0) {
        throw new Error('score must be a non-negative integer');
    }
    
    if (!Number.isInteger(totalQuestions) || totalQuestions < 1) {
        throw new Error('totalQuestions must be a positive integer');
    }
    
    const { data, error } = await supabase
        .from('quiz_attempts')
        .insert({
            quiz_id: quizId,
            user_id: userId,
            score,
            total_questions: totalQuestions,
            completed_at: new Date().toISOString()
        })
        .select()
        .single();
    
    if (error) {
        throw new DatabaseError(
            `Failed to create quiz attempt: ${error.message}`,
            { quizId, errorCode: error.code }
        );
    }
    
    return data;
}

/**
 * Get quiz attempts for a user
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} quizId - Quiz ID
 * @param {string|null} userId - User ID (nullable for anonymous)
 * @returns {Promise<Array>} Array of attempt records
 */
async function getQuizAttempts(supabase, quizId, userId) {
    validateSupabaseClient(supabase);
    
    if (!quizId) {
        throw new Error('quizId is required');
    }
    
    let query = supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .order('completed_at', { ascending: false });
    
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
        throw new DatabaseError(
            `Failed to get quiz attempts: ${error.message}`,
            { quizId, errorCode: error.code }
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

module.exports = {
    createQuiz,
    storeQuizQuestions,
    getQuizByDocumentSlug,
    getQuizQuestions,
    canRegenerateQuiz,
    updateQuizStatus,
    createQuizAttempt,
    getQuizAttempts,
    updateDocumentQuizzesGenerated
};

