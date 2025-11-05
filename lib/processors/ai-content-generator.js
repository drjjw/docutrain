/**
 * AI Content Generator
 * Generates abstracts and keywords using OpenAI with improved timeout handling and graceful degradation
 */

const { config } = require('../config/document-processing');
const { createRetryStrategy } = require('../utils/retry-strategy');
const { createTimeoutManager } = require('../utils/timeout-manager');
const { ProcessingError } = require('../errors/processing-errors');
const { validateOpenAIClient, validateChunks, sanitizeString } = require('../utils/input-validator');

/**
 * Generate a 100-word abstract from chunks using OpenAI
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Array} chunks - Array of chunk objects
 * @param {string} documentTitle - Document title
 * @param {Object} options - Options (timeout manager, retry strategy)
 * @returns {Promise<string|null>} Abstract text or null if generation fails
 */
async function generateAbstract(openaiClient, chunks, documentTitle, options = {}) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    
    // Validate inputs
    validateOpenAIClient(openaiClient);
    validateChunks(chunks, 'chunks');
    
    const sanitizedTitle = sanitizeString(documentTitle, 'documentTitle');
    
    console.log('🤖 Generating AI abstract');
    console.log(`   Document: ${sanitizedTitle}`);
    console.log(`   Total chunks available: ${chunks.length}`);
    
    try {
        // Use ALL chunks for better abstract quality (gpt-4o-mini supports 128k tokens)
        const chunksForAbstract = chunks;
        
        // Combine chunk content
        const combinedText = chunksForAbstract
            .map(chunk => chunk.content)
            .join('\n\n');
        
        // Truncate if too long
        const maxChars = config.ai.maxChars;
        const textForAbstract = combinedText.length > maxChars 
            ? combinedText.substring(0, maxChars) + '...'
            : combinedText;
        
        // Generate abstract with retry and timeout protection
        const abstract = await retryStrategy.execute(async () => {
            const apiPromise = openaiClient.chat.completions.create({
                model: config.ai.abstractModel,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating concise, informative abstracts from document content. Create a 100-word abstract that captures the key themes, purpose, and scope of the document.'
                    },
                    {
                        role: 'user',
                        content: `Please create a 100-word abstract for a document titled "${sanitizedTitle}". Base your abstract on the following content from the document:\n\n${textForAbstract}\n\nProvide ONLY the abstract text, no additional commentary. The abstract should be exactly 100 words.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            }, {
                timeout: config.ai.abstractTimeout
            });
            
            // Race against timeout
            const response = await timeoutManager.raceWithTimeout(
                apiPromise,
                config.ai.abstractHardTimeout,
                'OpenAI abstract API call exceeded timeout',
                'abstract generation'
            );
            
            const content = response.choices[0]?.message?.content?.trim();
            if (!content) {
                throw new ProcessingError('Empty response from OpenAI abstract API');
            }
            
            return content;
            
        }, {
            operationName: 'abstract generation',
            maxRetries: config.retry.maxRetries
        }).catch((error) => {
            console.error('⚠️ Failed to generate abstract:', error.message);
            return null; // Graceful degradation - return null instead of throwing
        });
        
        if (abstract) {
            console.log(`   ✓ Abstract generated (${abstract.split(/\s+/).length} words)`);
        }
        
        return abstract || null;
        
    } catch (error) {
        console.error('⚠️ Failed to generate abstract:', error.message);
        // Return null on error - don't fail the whole process (graceful degradation)
        return null;
    } finally {
        // Cleanup timeout manager
        timeoutManager.cleanup();
    }
}

/**
 * Generate keywords for word cloud from chunks using OpenAI
 * Returns an array of keyword objects with term and weight
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Array} chunks - Array of chunk objects
 * @param {string} documentTitle - Document title
 * @param {Object} options - Options (timeout manager, retry strategy)
 * @returns {Promise<Array|null>} Array of keyword objects or null if generation fails
 */
async function generateKeywords(openaiClient, chunks, documentTitle, options = {}) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    
    // Validate inputs
    validateOpenAIClient(openaiClient);
    validateChunks(chunks, 'chunks');
    
    const sanitizedTitle = sanitizeString(documentTitle, 'documentTitle');
    
    console.log('🔑 Generating AI keywords');
    console.log(`   Document: ${sanitizedTitle}`);
    console.log(`   Total chunks available: ${chunks.length}`);
    
    try {
        // Sample chunks from across the entire document for better keyword density analysis
        let chunksForKeywords = [];
        const totalChunks = chunks.length;
        
        if (totalChunks <= 50) {
            // If document is small, use all chunks
            chunksForKeywords = chunks;
        } else {
            // For larger documents, sample more chunks for better keyword density analysis
            // Target: Use ~10% of chunks, up to 300 chunks (to stay within token limits)
            const targetSampleSize = Math.min(300, Math.max(100, Math.floor(totalChunks * 0.1)));
            
            // Sample evenly across the document for comprehensive coverage
            const step = Math.floor(totalChunks / targetSampleSize);
            const usedIndices = new Set();
            
            for (let i = 0; i < totalChunks && chunksForKeywords.length < targetSampleSize; i += step) {
                const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                if (!usedIndices.has(chunkIndex)) {
                    chunksForKeywords.push(chunks[i]);
                    usedIndices.add(chunkIndex);
                }
            }
            
            // Ensure we have samples from beginning, middle, and end
            if (chunksForKeywords.length < targetSampleSize) {
                // Add beginning chunks if not already included
                for (let i = 0; i < Math.min(30, totalChunks) && chunksForKeywords.length < targetSampleSize; i++) {
                    const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                    if (!usedIndices.has(chunkIndex)) {
                        chunksForKeywords.push(chunks[i]);
                        usedIndices.add(chunkIndex);
                    }
                }
                
                // Add middle chunks
                const middleStart = Math.floor(totalChunks / 2) - 15;
                for (let i = middleStart; i < middleStart + 30 && chunksForKeywords.length < targetSampleSize && i < totalChunks; i++) {
                    const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                    if (!usedIndices.has(chunkIndex)) {
                        chunksForKeywords.push(chunks[i]);
                        usedIndices.add(chunkIndex);
                    }
                }
                
                // Add end chunks
                for (let i = Math.max(0, totalChunks - 30); i < totalChunks && chunksForKeywords.length < targetSampleSize; i++) {
                    const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                    if (!usedIndices.has(chunkIndex)) {
                        chunksForKeywords.push(chunks[i]);
                        usedIndices.add(chunkIndex);
                    }
                }
            }
            
            // Sort by original index to maintain some order
            chunksForKeywords.sort((a, b) => {
                const aIndex = a.index !== undefined ? a.index : chunks.indexOf(a);
                const bIndex = b.index !== undefined ? b.index : chunks.indexOf(b);
                return aIndex - bIndex;
            });
        }
        
        console.log(`   📋 Sampling ${chunksForKeywords.length} chunks from across document`);
        
        // Combine chunk content
        const combinedText = chunksForKeywords
            .map(chunk => chunk.content)
            .join('\n\n');
        
        // Truncate if too long
        const maxChars = config.ai.maxChars;
        const textForKeywords = combinedText.length > maxChars 
            ? combinedText.substring(0, maxChars) + '...'
            : combinedText;
        
        // Generate keywords with retry and timeout protection
        const content = await retryStrategy.execute(async () => {
            const apiPromise = openaiClient.chat.completions.create({
                model: config.ai.abstractModel,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at analyzing document content and extracting key terms and concepts. Identify the most important keywords, phrases, and concepts that would be useful for a word cloud visualization. Focus on domain-specific terms, key concepts, and important topics. Always respond with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: `Analyze the following document content and extract 20-30 key terms, phrases, and concepts that best represent this document. For each term, assign a weight from 0.1 to 1.0 based on its importance (1.0 = most important, 0.1 = less important but still relevant).\n\nDocument title: "${sanitizedTitle}"\n\nContent:\n${textForKeywords}\n\nReturn your response as a JSON object with a "keywords" property containing an array of objects, each with "term" (string) and "weight" (number) properties. Example format:\n{"keywords": [{"term": "kidney disease", "weight": 0.95}, {"term": "chronic kidney disease", "weight": 0.90}, {"term": "treatment", "weight": 0.75}]}\n\nProvide ONLY the JSON object, no additional commentary.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 800,
                response_format: { type: "json_object" }
            }, {
                timeout: config.ai.keywordTimeout
            });
            
            // Race against timeout
            const response = await timeoutManager.raceWithTimeout(
                apiPromise,
                config.ai.keywordHardTimeout,
                'OpenAI keyword API call exceeded timeout',
                'keyword generation'
            );
            
            return response.choices[0]?.message?.content?.trim();
            
        }, {
            operationName: 'keyword generation',
            maxRetries: config.retry.maxRetries
        }).catch(() => {
            console.error('⚠️ Failed to generate keywords');
            return null; // Graceful degradation
        });
        
        if (!content) {
            console.error('⚠️ No content in OpenAI response for keywords');
            return null;
        }
        
        // Parse JSON response
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (parseError) {
            console.error('⚠️ Failed to parse keywords JSON:', parseError.message);
            return null;
        }
        
        // Handle both direct array and wrapped object responses
        let keywords = null;
        if (Array.isArray(parsed)) {
            keywords = parsed;
        } else if (parsed.keywords && Array.isArray(parsed.keywords)) {
            keywords = parsed.keywords;
        } else if (parsed.terms && Array.isArray(parsed.terms)) {
            keywords = parsed.terms;
        } else {
            // Try to find any array in the response
            const keys = Object.keys(parsed);
            for (const key of keys) {
                if (Array.isArray(parsed[key])) {
                    keywords = parsed[key];
                    break;
                }
            }
        }
        
        if (!keywords || !Array.isArray(keywords)) {
            console.error('⚠️ Keywords not found in expected format. Parsed response:', JSON.stringify(parsed, null, 2));
            return null;
        }
        
        // Validate and clean keywords
        const validKeywords = keywords
            .filter(k => k && typeof k === 'object' && k.term && typeof k.term === 'string')
            .map(k => ({
                term: sanitizeString(k.term.trim()),
                weight: typeof k.weight === 'number' ? Math.max(0.1, Math.min(1.0, k.weight)) : 0.5
            }))
            .filter(k => k.term.length > 0)
            .slice(0, 30); // Limit to 30 keywords
        
        if (validKeywords.length === 0) {
            console.error('⚠️ No valid keywords after filtering. Original keywords array length:', keywords.length);
            return null;
        }
        
        console.log(`   ✓ Generated ${validKeywords.length} keywords`);
        return validKeywords;
        
    } catch (error) {
        console.error('⚠️ Failed to generate keywords:', error.message);
        // Return null on error - don't fail the whole process (graceful degradation)
        return null;
    } finally {
        // Cleanup timeout manager
        timeoutManager.cleanup();
    }
}

/**
 * Generate both abstract and keywords in parallel
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Array} chunks - Array of chunk objects
 * @param {string} documentTitle - Document title
 * @param {Object} options - Options (timeout manager, retry strategy)
 * @returns {Promise<{abstract: string|null, keywords: Array|null}>}
 */
async function generateAbstractAndKeywords(openaiClient, chunks, documentTitle, options = {}) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    
    try {
        // Generate in parallel for better performance
        const [abstract, keywords] = await Promise.all([
            generateAbstract(openaiClient, chunks, documentTitle, { timeoutManager, ...options }),
            generateKeywords(openaiClient, chunks, documentTitle, { timeoutManager, ...options })
        ]);
        
        return { abstract, keywords };
        
    } catch (error) {
        console.error('⚠️ Error generating abstract/keywords:', error.message);
        // Graceful degradation - return nulls instead of throwing
        return { abstract: null, keywords: null };
    } finally {
        // Cleanup timeout manager
        timeoutManager.cleanup();
    }
}

module.exports = {
    generateAbstract,
    generateKeywords,
    generateAbstractAndKeywords
};

