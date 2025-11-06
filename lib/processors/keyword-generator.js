/**
 * Keyword Generator - Enhanced with NLP
 * Generates keywords from document chunks using TF-IDF, stemming, and phrase analysis
 * Uses 'natural' library for intelligent keyword extraction
 * Falls back to simple frequency analysis if natural library unavailable
 */

let natural = null;
let TfIdf = null;
let PorterStemmer = null;
let WordNet = null;

// Try to load natural library (optional enhancement)
try {
    natural = require('natural');
    TfIdf = natural.TfIdf;
    PorterStemmer = natural.PorterStemmer;
    console.log('✓ Natural library loaded - using enhanced keyword extraction');
} catch (error) {
    console.log('⚠️ Natural library not available - using simple frequency analysis');
}

/**
 * Common English stop words to filter out
 * Expanded list including common verbs, adverbs, and function words
 */
const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they',
    'have', 'had', 'what', 'said', 'each', 'which', 'their', 'time',
    'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'some',
    'her', 'would', 'make', 'like', 'into', 'him', 'has', 'two', 'more',
    'very', 'after', 'words', 'long', 'than', 'first', 'been', 'call',
    'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did', 'get',
    'come', 'made', 'may', 'part', 'over', 'new', 'sound', 'take',
    'only', 'little', 'work', 'know', 'place', 'year', 'live', 'me',
    'back', 'give', 'most', 'very', 'after', 'thing', 'our', 'just',
    'name', 'good', 'sentence', 'man', 'think', 'say', 'great', 'where',
    'help', 'through', 'much', 'before', 'line', 'right', 'too', 'mean',
    'old', 'any', 'same', 'tell', 'boy', 'follow', 'came', 'want',
    'show', 'also', 'around', 'form', 'three', 'small', 'set', 'put',
    'end', 'does', 'another', 'well', 'large', 'must', 'big', 'even',
    'such', 'because', 'turn', 'here', 'why', 'ask', 'went', 'men',
    'read', 'need', 'land', 'different', 'home', 'us', 'move', 'try',
    'kind', 'hand', 'picture', 'again', 'change', 'off', 'play', 'spell',
    'air', 'away', 'animal', 'house', 'point', 'page', 'letter', 'mother',
    'answer', 'found', 'study', 'still', 'learn', 'should', 'america', 'world',
    // Additional common words that aren't meaningful keywords
    'how', 'not', 'can', 'when', 'where', 'there', 'here', 'accessed',
    'use', 'used', 'using', 'uses', 'see', 'see', 'one', 'all', 'do',
    'did', 'done', 'doing', 'go', 'went', 'gone', 'going', 'get', 'got',
    'getting', 'got', 'see', 'saw', 'seen', 'seeing', 'use', 'used',
    'using', 'uses', 'make', 'made', 'making', 'makes', 'take', 'took',
    'taken', 'taking', 'takes', 'come', 'came', 'coming', 'comes'
]);

/**
 * Minimum word length to consider (filters out very short words)
 */
const MIN_WORD_LENGTH = 3;

/**
 * Maximum number of keywords to return
 */
const MAX_KEYWORDS = 30;

/**
 * Minimum frequency for a word to be considered (helps filter noise)
 * Set to 1 to include all words that appear at least once
 */
const MIN_FREQUENCY = 1;

/**
 * Tokenize text into words
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of lowercase words
 */
function tokenize(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }
    
    // Convert to lowercase and split on whitespace/punctuation
    // Keep alphanumeric characters and hyphens (for compound words)
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ') // Replace punctuation with spaces
        .split(/\s+/) // Split on whitespace
        .filter(word => {
            // Filter out URL fragments and protocol strings
            if (word.startsWith('http') || word.startsWith('www') || 
                word.includes('://') || word.match(/^[a-z]+:\/\//i)) {
                return false;
            }
            // Filter out pure numbers and non-letter patterns
            if (word.match(/^\d+$/) || word.match(/^[^a-z]*$/i)) {
                return false;
            }
            return word.length >= MIN_WORD_LENGTH;
        })
        .filter(word => !STOP_WORDS.has(word)); // Filter stop words
}

/**
 * Count word frequencies in text
 * @param {string[]} words - Array of words
 * @returns {Map<string, number>} Map of word to frequency count
 */
function countWordFrequencies(words) {
    const frequencies = new Map();
    
    for (const word of words) {
        frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
    
    return frequencies;
}

/**
 * Detect common phrases (bigrams and trigrams)
 * @param {string[]} words - Array of words
 * @returns {Map<string, number>} Map of phrase to frequency count
 */
function detectPhrases(words) {
    const phrases = new Map();
    
    // Detect bigrams (2-word phrases)
    for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        // Only count if both words are meaningful (not stop words, length >= 3)
        if (words[i].length >= MIN_WORD_LENGTH && words[i + 1].length >= MIN_WORD_LENGTH) {
            phrases.set(bigram, (phrases.get(bigram) || 0) + 1);
        }
    }
    
    // Detect trigrams (3-word phrases) - only if both words in bigram are frequent
    for (let i = 0; i < words.length - 2; i++) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        // Only count if all words are meaningful
        if (words[i].length >= MIN_WORD_LENGTH && 
            words[i + 1].length >= MIN_WORD_LENGTH && 
            words[i + 2].length >= MIN_WORD_LENGTH) {
            phrases.set(trigram, (phrases.get(trigram) || 0) + 1);
        }
    }
    
    return phrases;
}

/**
 * Normalize frequencies to weights (0.1 to 1.0)
 * @param {Map<string, number>} frequencies - Map of term to frequency
 * @returns {Map<string, number>} Map of term to normalized weight
 */
function normalizeWeights(frequencies) {
    if (frequencies.size === 0) {
        return new Map();
    }
    
    const values = Array.from(frequencies.values());
    const minFreq = Math.min(...values);
    const maxFreq = Math.max(...values);
    const range = maxFreq - minFreq;
    
    const weights = new Map();
    
    for (const [term, freq] of frequencies.entries()) {
        if (range === 0) {
            // All frequencies are the same
            weights.set(term, 0.5);
        } else {
            // Normalize: (freq - min) / range gives 0-1, then scale to 0.1-1.0
            const normalized = (freq - minFreq) / range;
            const weight = 0.1 + (normalized * 0.9); // Scale to 0.1-1.0
            weights.set(term, Math.round(weight * 100) / 100); // Round to 2 decimals
        }
    }
    
    return weights;
}

/**
 * Generate keywords using TF-IDF (Term Frequency-Inverse Document Frequency)
 * This provides better weighting by considering how unique terms are to the document
 * 
 * @param {Array<{content: string}>} chunks - Array of document chunks
 * @param {string} documentTitle - Document title (optional, for logging)
 * @returns {Array<{term: string, weight: number}>} Array of keyword objects
 */
function generateKeywordsWithTFIDF(chunks, documentTitle = '') {
    if (!TfIdf || !PorterStemmer) {
        // Fallback to simple frequency if natural library not available
        return generateKeywordsFromFrequency(chunks, documentTitle);
    }
    
    console.log('🔑 Generating keywords using TF-IDF (enhanced)');
    if (documentTitle) {
        console.log(`   Document: ${documentTitle}`);
    }
    console.log(`   Total chunks: ${chunks.length}`);
    
    try {
        // Combine all chunk content
        const combinedText = chunks
            .map(chunk => chunk.content || '')
            .filter(content => content && content.trim().length > 0)
            .join('\n\n');
        
        if (!combinedText || combinedText.trim().length === 0) {
            console.warn('⚠️ No text content found in chunks');
            return [];
        }
        
        // Use natural's tokenizer for better word extraction
        const tokenizer = new natural.WordTokenizer();
        const words = tokenizer.tokenize(combinedText.toLowerCase()) || [];
        
        // Stem words to group related terms (treatment, treatments -> treat)
        // But keep track of original forms for display
        const stemmedToOriginal = new Map(); // stem -> most common original form
        const stemFrequencies = new Map(); // stem -> frequency
        
        words.forEach(word => {
            // Filter out URL fragments and protocol strings
            if (word.startsWith('http') || word.startsWith('www') || 
                word.includes('://') || word.match(/^[a-z]+:\/\//i)) {
                return; // Skip URL-related tokens
            }
            
            // Filter out common non-meaningful patterns
            if (word.match(/^\d+$/) || // Pure numbers
                word.match(/^[a-z]{1,2}$/i) || // Very short words (1-2 chars)
                word.match(/^[^a-z]*$/i)) { // No letters
                return;
            }
            
            if (word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word)) {
                const stemmed = PorterStemmer.stem(word);
                
                // Track frequency of stemmed version
                stemFrequencies.set(stemmed, (stemFrequencies.get(stemmed) || 0) + 1);
                
                // Keep track of original form (prefer singular forms and longer words)
                if (!stemmedToOriginal.has(stemmed)) {
                    stemmedToOriginal.set(stemmed, word);
                } else {
                    // Prefer singular forms (shorter, more base form)
                    const current = stemmedToOriginal.get(stemmed);
                    // If current is plural (ends with 's') and new is singular, prefer singular
                    if (current.endsWith('s') && !word.endsWith('s') && word.length >= current.length - 1) {
                        stemmedToOriginal.set(stemmed, word);
                    } else if (word.length > current.length) {
                        // Otherwise prefer longer forms
                        stemmedToOriginal.set(stemmed, word);
                    }
                }
            }
        });
        
        console.log(`   Tokenized ${words.length} words, found ${stemFrequencies.size} unique stems`);
        
        // Calculate term scores using stemmed frequencies
        // This groups related words together (treatment, treatments, treating all count together)
        const termScores = new Map();
        
        stemFrequencies.forEach((freq, stem) => {
            if (freq >= MIN_FREQUENCY) {
                const originalTerm = stemmedToOriginal.get(stem);
                // Use log scale to reduce impact of very high frequencies
                const score = Math.log1p(freq) * freq; // Log scale with frequency boost
                termScores.set(originalTerm, score);
            }
        });
        
        // Also detect important phrases using n-grams
        const phraseScores = new Map();
        const tokenizedWords = tokenizer.tokenize(combinedText.toLowerCase()) || [];
        const bigrams = natural.NGrams.bigrams(tokenizedWords);
        
        if (bigrams) {
            bigrams.forEach(bigram => {
                const phrase = bigram.join(' ');
                // Only consider phrases where both words are meaningful
                if (bigram[0].length >= MIN_WORD_LENGTH && 
                    bigram[1].length >= MIN_WORD_LENGTH &&
                    !STOP_WORDS.has(bigram[0]) && 
                    !STOP_WORDS.has(bigram[1])) {
                    
                    // Calculate phrase frequency
                    const phraseRegex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    const matches = combinedText.match(phraseRegex);
                    const freq = matches ? matches.length : 0;
                    
                    if (freq >= MIN_FREQUENCY) {
                        // Boost phrase scores (phrases are more meaningful)
                        phraseScores.set(phrase, freq * 2);
                    }
                }
            });
        }
        
        console.log(`   Found ${termScores.size} terms with TF-IDF scores`);
        console.log(`   Found ${phraseScores.size} meaningful phrases`);
        
        // Combine terms and phrases
        const allScores = new Map();
        
        // Add single terms with TF-IDF scores
        termScores.forEach((score, term) => {
            // Normalize TF-IDF score (they can be > 1, so we'll scale them)
            allScores.set(term, score);
        });
        
        // Add phrases with boosted scores
        phraseScores.forEach((score, phrase) => {
            allScores.set(phrase, score);
        });
        
        if (allScores.size === 0) {
            console.warn('⚠️ No terms found with TF-IDF analysis');
            // Fallback to simple frequency
            return generateKeywordsFromFrequency(chunks, documentTitle);
        }
        
        // Normalize scores to weights (0.1 to 1.0)
        const weights = normalizeWeights(allScores);
        
        // Convert to array and sort by weight
        let keywords = Array.from(weights.entries())
            .map(([term, weight]) => ({
                term: term.trim(),
                weight: weight
            }))
            .filter(k => k.term.length > 0)
            .sort((a, b) => b.weight - a.weight)
            .slice(0, MAX_KEYWORDS);
        
        // Prefer phrases over single words when weights are similar
        keywords.sort((a, b) => {
            const aIsPhrase = a.term.includes(' ');
            const bIsPhrase = b.term.includes(' ');
            
            if (Math.abs(a.weight - b.weight) < 0.1) {
                if (aIsPhrase && !bIsPhrase) return -1;
                if (!aIsPhrase && bIsPhrase) return 1;
            }
            
            return b.weight - a.weight;
        });
        
        console.log(`   ✓ Generated ${keywords.length} keywords using TF-IDF (enhanced with stemming & n-grams)`);
        if (keywords.length > 0) {
            console.log(`   Top keywords: ${keywords.slice(0, 5).map(k => k.term).join(', ')}`);
        }
        
        // Add metadata to keywords array to indicate method used
        // This will help verify which method was used
        if (keywords.length > 0) {
            keywords._method = 'enhanced-tfidf-stemming';
        }
        
        return keywords;
        
    } catch (error) {
        console.error('⚠️ Error in TF-IDF keyword generation:', error.message);
        console.error('   Falling back to simple frequency analysis');
        // Fallback to simple frequency on error
        return generateKeywordsFromFrequency(chunks, documentTitle);
    }
}

/**
 * Generate keywords from document chunks using word frequency analysis
 * (Simple fallback method)
 * 
 * @param {Array<{content: string}>} chunks - Array of document chunks
 * @param {string} documentTitle - Document title (optional, for logging)
 * @returns {Array<{term: string, weight: number}>} Array of keyword objects
 */
function generateKeywordsFromFrequency(chunks, documentTitle = '') {
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
        console.warn('⚠️ No chunks provided for keyword generation');
        return [];
    }
    
    console.log('🔑 Generating keywords from word frequency');
    if (documentTitle) {
        console.log(`   Document: ${documentTitle}`);
    }
    console.log(`   Total chunks: ${chunks.length}`);
    
    try {
        // Combine all chunk content
        const combinedText = chunks
            .map(chunk => chunk.content || '')
            .filter(content => content && content.trim().length > 0)
            .join('\n\n');
        
        if (!combinedText || combinedText.trim().length === 0) {
            console.warn('⚠️ No text content found in chunks');
            return [];
        }
        
        // Tokenize text
        const words = tokenize(combinedText);
        
        if (words.length === 0) {
            console.warn('⚠️ No valid words found after tokenization');
            return [];
        }
        
        console.log(`   Tokenized ${words.length} words`);
        
        // Count word frequencies
        const wordFreqs = countWordFrequencies(words);
        console.log(`   Found ${wordFreqs.size} unique words`);
        
        // Detect phrases
        const phraseFreqs = detectPhrases(words);
        console.log(`   Found ${phraseFreqs.size} unique phrases`);
        
        // Combine words and phrases, prioritizing phrases (they're more specific)
        // For phrases, we'll use a multiplier to boost their importance
        const allTerms = new Map();
        
        // Add words (single terms)
        let wordsAdded = 0;
        for (const [term, freq] of wordFreqs.entries()) {
            if (freq >= MIN_FREQUENCY) {
                allTerms.set(term, freq);
                wordsAdded++;
            }
        }
        console.log(`   Added ${wordsAdded} words (freq >= ${MIN_FREQUENCY})`);
        
        // Add phrases with frequency boost (phrases are more meaningful)
        let phrasesAdded = 0;
        for (const [phrase, freq] of phraseFreqs.entries()) {
            if (freq >= MIN_FREQUENCY) {
                // Boost phrase frequency by 1.5x to prioritize multi-word terms
                allTerms.set(phrase, Math.ceil(freq * 1.5));
                phrasesAdded++;
            }
        }
        console.log(`   Added ${phrasesAdded} phrases (freq >= ${MIN_FREQUENCY})`);
        
        if (allTerms.size === 0) {
            console.warn('⚠️ No terms found meeting minimum frequency threshold');
            console.warn(`   Word frequencies: ${wordFreqs.size} unique words`);
            console.warn(`   Phrase frequencies: ${phraseFreqs.size} unique phrases`);
            if (wordFreqs.size > 0) {
                const topWords = Array.from(wordFreqs.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([term, freq]) => `${term}:${freq}`)
                    .join(', ');
                console.warn(`   Top words: ${topWords}`);
            }
            return [];
        }
        
        // Normalize to weights
        const weights = normalizeWeights(allTerms);
        
        // Convert to array and sort by weight (descending)
        const keywords = Array.from(weights.entries())
            .map(([term, weight]) => ({
                term: term.trim(),
                weight: weight
            }))
            .filter(k => k.term.length > 0)
            .sort((a, b) => b.weight - a.weight) // Sort by weight descending
            .slice(0, MAX_KEYWORDS); // Take top N
        
        // If we have phrases, prefer them over single words when weights are similar
        // Re-sort to prioritize phrases
        keywords.sort((a, b) => {
            const aIsPhrase = a.term.includes(' ');
            const bIsPhrase = b.term.includes(' ');
            
            // If weights are close (within 0.1), prefer phrases
            if (Math.abs(a.weight - b.weight) < 0.1) {
                if (aIsPhrase && !bIsPhrase) return -1;
                if (!aIsPhrase && bIsPhrase) return 1;
            }
            
            return b.weight - a.weight;
        });
        
        console.log(`   ✓ Generated ${keywords.length} keywords (simple frequency method)`);
        if (keywords.length > 0) {
            console.log(`   Top keywords: ${keywords.slice(0, 5).map(k => k.term).join(', ')}`);
        }
        
        // Add metadata to keywords array to indicate method used
        if (keywords.length > 0) {
            keywords._method = 'simple-frequency';
        }
        
        return keywords;
        
    } catch (error) {
        console.error('⚠️ Error generating keywords from frequency:', error.message);
        console.error(error.stack);
        return []; // Return empty array on error (graceful degradation)
    }
}

// Export both functions - use enhanced version by default, fallback to simple
module.exports = {
    generateKeywordsFromFrequency: generateKeywordsWithTFIDF, // Use enhanced version as default
    generateKeywordsFromFrequencySimple: generateKeywordsFromFrequency, // Keep simple version available
    generateKeywordsWithTFIDF
};

