/**
 * Quiz Generator
 * Generates multiple-choice quiz questions from document chunks using OpenAI
 */

const { config } = require('../config/document-processing');
const { createRetryStrategy } = require('../utils/retry-strategy');
const { createTimeoutManager } = require('../utils/timeout-manager');
const { ProcessingError } = require('../errors/processing-errors');
const { validateOpenAIClient, validateChunks, sanitizeString } = require('../utils/input-validator');
const { debugLog } = require('../utils/debug');

/**
 * Generate quiz questions from chunks using OpenAI
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Array} chunks - Array of chunk objects with content
 * @param {string} documentTitle - Document title
 * @param {number} numQuestions - Number of questions to generate (default: 5)
 * @param {Object} options - Options (timeout manager, retry strategy)
 * @returns {Promise<Array|null>} Array of question objects or null if generation fails
 */
async function generateQuizQuestions(openaiClient, chunks, documentTitle, numQuestions = 5, options = {}) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    const shouldCleanup = !options.timeoutManager;
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    
    // Validate inputs
    validateOpenAIClient(openaiClient);
    validateChunks(chunks, 'chunks');
    
    if (!Number.isInteger(numQuestions) || numQuestions < 1 || numQuestions > 20) {
        throw new Error('numQuestions must be an integer between 1 and 20');
    }
    
    const sanitizedTitle = sanitizeString(documentTitle, 'documentTitle');
    const chunkCount = chunks.length;
    
    debugLog('📝 Generating quiz questions');
    debugLog(`   Document: ${sanitizedTitle}`);
    debugLog(`   Chunks available: ${chunkCount}`);
    debugLog(`   Questions requested: ${numQuestions}`);
    
    if (chunkCount === 0) {
        console.error('⚠️ No chunks available for quiz generation');
        return null;
    }
    
    // Calculate timeout based on number of questions and chunks
    const baseTimeoutMs = 30 * 1000; // 30 seconds base
    const perQuestionTimeoutMs = 5 * 1000; // 5 seconds per question
    const perChunkTimeoutMs = 1 * 1000; // 1 second per chunk
    const calculatedTimeoutMs = baseTimeoutMs + (numQuestions * perQuestionTimeoutMs) + (chunkCount * perChunkTimeoutMs);
    const maxTimeoutMs = 2 * 60 * 1000; // Cap at 2 minutes
    const finalTimeoutMs = Math.min(Math.max(calculatedTimeoutMs, baseTimeoutMs), maxTimeoutMs);
    
    debugLog(`   Timeout: ${(finalTimeoutMs / 1000).toFixed(1)}s`);
    
    try {
        // Combine chunk content
        const combinedText = chunks
            .map(chunk => chunk.content || '')
            .filter(content => content && content.trim().length > 0)
            .join('\n\n');
        
        if (!combinedText || combinedText.trim().length === 0) {
            console.error('⚠️ No valid chunk content available');
            return null;
        }
        
        // Truncate if too long (leave room for prompt and response)
        const maxChars = config.ai.maxChars || 400000;
        const textForQuiz = combinedText.length > maxChars 
            ? combinedText.substring(0, maxChars) + '...'
            : combinedText;
        
        // Generate questions with retry and timeout protection
        const questions = await retryStrategy.execute(async () => {
            const requestStartTime = Date.now();
            const requestSize = textForQuiz.length;
            const estimatedTokens = Math.ceil(requestSize / 4);
            debugLog(`   📊 Request size: ${requestSize.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens)`);
            debugLog(`   ⏱️  Timeout: ${(finalTimeoutMs / 1000).toFixed(1)}s`);
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    const elapsed = Date.now() - requestStartTime;
                    console.error(`   ❌ Quiz generation TIMEOUT after ${(elapsed / 1000).toFixed(1)}s`);
                    reject(new Error(`OpenAI quiz API call exceeded maximum timeout (${(finalTimeoutMs / 1000).toFixed(1)}s)`));
                }, finalTimeoutMs);
            });
            
            debugLog(`   🚀 Sending OpenAI API request for quiz questions...`);
            
            const apiPromise = openaiClient.chat.completions.create({
                model: config.ai.abstractModel || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating educational quiz questions from document content. Generate clear, accurate multiple-choice questions that test understanding of the material. Each question must have exactly 4 options (A, B, C, D) with one clearly correct answer. Make questions challenging but fair, based directly on the provided content.'
                    },
                    {
                        role: 'user',
                        content: `Generate ${numQuestions} multiple-choice questions based on the following document content from "${sanitizedTitle}".

Each question must have:
- A clear, specific question
- Exactly 4 options (A, B, C, D)
- One correct answer (indicated by correctAnswer index 0-3)
- Three plausible distractors

Return your response as a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "What is...?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": 1
    }
  ]
}

Document content:
${textForQuiz}

Provide ONLY the JSON object, no additional commentary.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000 + (numQuestions * 200), // Scale with number of questions
                response_format: { type: "json_object" }
            }, {
                timeout: Math.min(config.ai.abstractTimeout || 60000, finalTimeoutMs - 5000)
            });
            
            let response;
            try {
                response = await Promise.race([
                    apiPromise.then(result => {
                        const elapsed = Date.now() - requestStartTime;
                        debugLog(`   ✅ OpenAI API responded in ${(elapsed / 1000).toFixed(1)}s`);
                        return result;
                    }),
                    timeoutPromise
                ]);
            } catch (error) {
                const elapsed = Date.now() - requestStartTime;
                console.error(`   ❌ OpenAI API error after ${(elapsed / 1000).toFixed(1)}s:`, error.message);
                throw error;
            }
            
            const content = response.choices[0]?.message?.content?.trim();
            if (!content) {
                throw new ProcessingError('Empty response from OpenAI quiz API');
            }
            
            // Parse JSON response
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                // Try to extract JSON from markdown code blocks if present
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error(`Failed to parse JSON response: ${parseError.message}`);
                }
            }
            
            const questionsArray = parsed.questions || parsed.question || [];
            if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
                throw new ProcessingError('No questions found in API response');
            }
            
            // Validate and normalize questions
            const validatedQuestions = questionsArray
                .slice(0, numQuestions) // Limit to requested number
                .map((q, index) => {
                    // Validate structure
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
                        question: q.question.trim(),
                        options: q.options.map(opt => String(opt).trim()),
                        correctAnswer: q.correctAnswer
                    };
                });
            
            if (validatedQuestions.length === 0) {
                throw new ProcessingError('No valid questions generated');
            }
            
            debugLog(`   ✓ Generated ${validatedQuestions.length} quiz questions`);
            return validatedQuestions;
            
        }, {
            operationName: 'quiz generation',
            maxRetries: config.retry.maxRetries
        }).catch((error) => {
            console.error('⚠️ Failed to generate quiz questions:', error.message);
            return null;
        });
        
        return questions;
        
    } catch (error) {
        console.error('⚠️ Failed to generate quiz questions:', error.message);
        return null;
    } finally {
        if (shouldCleanup) {
            timeoutManager.cleanup();
        }
    }
}

module.exports = {
    generateQuizQuestions
};

