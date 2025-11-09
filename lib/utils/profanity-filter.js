/**
 * Custom Profanity Filter using naughty-words word list
 * Based on Shutterstock's comprehensive word list
 * https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
 */

const naughtyWords = require('naughty-words');

// Multi-language word lists
// Primary: English (always enabled)
const englishWords = new Set(naughtyWords.en.map(word => word.toLowerCase()));

// Additional languages - enable as needed
const spanishWords = new Set(naughtyWords.es.map(word => word.toLowerCase()));
const frenchWords = new Set(naughtyWords.fr.map(word => word.toLowerCase()));
const germanWords = new Set(naughtyWords.de.map(word => word.toLowerCase()));
const italianWords = new Set(naughtyWords.it.map(word => word.toLowerCase()));
const portugueseWords = new Set(naughtyWords.pt.map(word => word.toLowerCase()));
const russianWords = new Set(naughtyWords.ru.map(word => word.toLowerCase()));
const chineseWords = new Set(naughtyWords.zh.map(word => word.toLowerCase()));
const japaneseWords = new Set(naughtyWords.ja.map(word => word.toLowerCase()));
const koreanWords = new Set(naughtyWords.ko.map(word => word.toLowerCase()));
const hindiWords = new Set(naughtyWords.hi.map(word => word.toLowerCase()));
const arabicWords = new Set(naughtyWords.ar.map(word => word.toLowerCase()));

// Custom additions - add any words specific to your needs
const customWords = new Set([
    'n-word',
    'n word',
    // Add any other custom words here
]);

// Combine all word lists for multi-language detection
const profanitySet = new Set([
    ...englishWords,
    ...spanishWords,
    ...frenchWords,
    ...germanWords,
    ...italianWords,
    ...portugueseWords,
    ...russianWords,
    ...chineseWords,
    ...japaneseWords,
    ...koreanWords,
    ...hindiWords,
    ...arabicWords,
    ...customWords,
]);

/**
 * Normalize text for better detection (handles some evasion techniques)
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Convert to lowercase
    let normalized = text.toLowerCase();
    
    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Normalize leet speak and character substitutions
    // Replace common leet substitutions with their letter equivalents
    // BUT: Only convert ! to i when it's in the middle of a word (leet), not punctuation
    normalized = normalized
        .replace(/[0]/g, 'o')  // 0 -> o
        .replace(/[1]/g, 'i')  // 1 -> i
        .replace(/[3]/g, 'e')  // 3 -> e
        .replace(/[4]/g, 'a')  // 4 -> a
        .replace(/[5]/g, 's')  // 5 -> s
        .replace(/[7]/g, 't')  // 7 -> t
        .replace(/[@]/g, 'a')  // @ -> a
        .replace(/([a-z])!([a-z])/g, '$1i$2')  // ! -> i only when between letters (leet)
        .replace(/[$]/g, 's')  // $ -> s
        .replace(/[|]/g, 'i')   // | -> i
        .replace(/[|]/g, 'l');  // | -> l (second pass for different context)
    
    // Remove separators (common in evasion: f*ck, f_u_c_k, f-u-c-k, f.u.c.k)
    // Do this AFTER leet normalization so we don't break number->letter conversions
    normalized = normalized
        .replace(/[*]/g, '')   // * -> remove (common in f*ck)
        .replace(/[_]/g, '')    // _ -> remove (common in f_u_c_k)
        .replace(/[-]/g, '')    // - -> remove (common in f-u-c-k)
        .replace(/[.]/g, '');   // . -> remove (common in f.u.c.k)
    
    // Remove spaces between single characters (handles "f u c k" -> "fuck")
    // Only if it looks like spaced-out profanity (3+ single chars separated by spaces)
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\s+([a-z]+)\b/g, '$1$2$3$4');
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\b/g, '$1$2$3');
    
    // Remove common punctuation that might be used to evade
    normalized = normalized.replace(/[.,!?;:'"()\[\]{}]/g, '');
    
    return normalized.trim();
}

/**
 * Check if two words are similar (handles missing characters from separator removal)
 * For example: "fck" is similar to "fuck" (missing 'u')
 * Only matches if the word is clearly an evasion attempt (not a legitimate word)
 */
function isSimilarWord(word, profanity) {
    if (word === profanity) return true;
    
    // Only check if word is shorter than profanity by exactly 1-2 chars
    // This catches cases like "fck" -> "fuck" (missing 'u') or "sh1t" -> "shit" (after normalization)
    if (word.length < profanity.length && word.length >= profanity.length - 2) {
        // Check if word matches profanity when we account for missing characters
        // Use a simple character-by-character match allowing for 1-2 missing chars
        let wordIdx = 0;
        let profIdx = 0;
        let missingCount = 0;
        
        while (wordIdx < word.length && profIdx < profanity.length) {
            if (word[wordIdx] === profanity[profIdx]) {
                wordIdx++;
                profIdx++;
            } else {
                // Character doesn't match - might be missing in word
                // Only allow missing vowels (a, e, i, o, u) to avoid false positives
                if ('aeiou'.includes(profanity[profIdx])) {
                    profIdx++;
                    missingCount++;
                    if (missingCount > 2) return false; // Too many missing chars
                } else {
                    // Non-vowel mismatch - not similar
                    return false;
                }
            }
        }
        
        // If we've matched all of word and missing chars are only vowels, it's similar
        if (wordIdx === word.length && missingCount <= 2 && missingCount > 0) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if text contains profanity
 * @param {string} text - Text to check
 * @returns {boolean} - True if profanity detected
 */
function containsProfanity(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    try {
        // Normalize the text
        const normalized = normalizeText(text);
        
        // Split into words (using word boundaries)
        // Remove punctuation and split on whitespace
        const words = normalized.split(/\s+/).map(w => w.trim()).filter(w => w.length > 0);
        
        // Check each word for exact matches only
        for (const word of words) {
            // Direct exact match (whole word only)
            if (profanitySet.has(word)) {
                return true;
            }
        }
        
        // Check full text for multi-word phrases (e.g., "n-word", "mother fucker")
        // Only check phrases that are 2+ words to avoid substring false positives
        const fullText = normalized;
        for (const profanity of profanitySet) {
            // Only check phrases with spaces (multi-word) or single words that are at least 4 chars
            // This avoids matching short substrings like "con", "ass", "cum" in legitimate words
            if (profanity.includes(' ') || profanity.length >= 4) {
                // Use word boundaries for single words, or exact phrase match for multi-word
                if (profanity.includes(' ')) {
                    // Multi-word phrase - check exact phrase match
                    if (fullText.includes(profanity)) {
                        return true;
                    }
                } else {
                    // Single word - use word boundary regex to avoid substring matches
                    // Also check if normalized word matches (handles leet speak normalization)
                    const wordBoundaryRegex = new RegExp(`\\b${profanity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    if (wordBoundaryRegex.test(fullText)) {
                        return true;
                    }
                    
                    // Check if any word in the text, after normalization, matches profanity
                    // This catches cases like "f*ck" -> "fck" which should match "fuck"
                    // Use fuzzy matching: if normalized word is similar to profanity (within 1-2 char difference)
                    // BUT only check if the word is suspiciously short (likely missing chars from separators)
                    for (const word of words) {
                        // Only check similar words if:
                        // 1. Word is shorter than profanity (missing chars from separator removal)
                        // 2. Word length is at least 3 (avoid matching short legitimate words)
                        // 3. Word is within 1-2 chars of profanity length
                        if (word.length < profanity.length && 
                            word.length >= 3 && 
                            word.length >= profanity.length - 2) {
                            // Check if word matches profanity when we account for removed separators
                            // For example: "fck" should match "fuck" (missing 'u' due to * removal)
                            if (isSimilarWord(word, profanity)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error checking profanity:', error);
        // On error, default to not banning (can be manually reviewed)
        return false;
    }
}

/**
 * Get word count in the filter
 */
function getWordCount() {
    return profanitySet.size;
}

/**
 * Get supported languages
 */
function getSupportedLanguages() {
    return Object.keys(naughtyWords).filter(k => k.length === 2);
}

/**
 * Check if text is junk (short, garbled, meaningless)
 * @param {string} text - Text to check
 * @returns {object} - { isJunk: boolean, reason: string | null }
 */
function isJunk(text) {
    if (!text || typeof text !== 'string') {
        return { isJunk: false, reason: null };
    }

    const trimmed = text.trim();
    
    // Check 1: Too short (less than 3 characters)
    // Exception: Allow 2-character strings that are all letters (likely acronyms like "DM", "CKD")
    if (trimmed.length < 3) {
        // If it's 2 characters and all letters, allow it (could be acronym)
        if (trimmed.length === 2 && /^[a-zA-Z]{2}$/.test(trimmed)) {
            return { isJunk: false, reason: null };
        }
        return { isJunk: true, reason: 'junk' };
    }

    // Check 2: Only whitespace or special characters
    const withoutWhitespace = trimmed.replace(/\s/g, '');
    if (withoutWhitespace.length === 0) {
        return { isJunk: true, reason: 'junk' };
    }

    // Check 3: Mostly special characters or numbers (less than 30% letters)
    const letterCount = (withoutWhitespace.match(/[a-zA-Z]/g) || []).length;
    const letterRatio = letterCount / withoutWhitespace.length;
    if (letterRatio < 0.3 && withoutWhitespace.length > 2) {
        return { isJunk: true, reason: 'junk' };
    }

    // Check 4: Excessive repeated characters (e.g., "aaaaaa", "111111")
    // If more than 50% of characters are the same character
    const charCounts = {};
    for (const char of withoutWhitespace.toLowerCase()) {
        charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const maxCharCount = Math.max(...Object.values(charCounts));
    if (maxCharCount / withoutWhitespace.length > 0.5 && withoutWhitespace.length >= 4) {
        return { isJunk: true, reason: 'junk' };
    }

    // Check 5: Random character patterns (e.g., "asdfgh", "qwerty", "zxcvbn")
    // Check for keyboard patterns
    const keyboardPatterns = [
        /^[qwertyuiop]+$/i,
        /^[asdfghjkl]+$/i,
        /^[zxcvbnm]+$/i,
        /^[1234567890]+$/i,
        /^[qwerty]+$/i,
        /^[asdf]+$/i,
        /^[zxcv]+$/i,
    ];
    for (const pattern of keyboardPatterns) {
        if (pattern.test(withoutWhitespace) && withoutWhitespace.length >= 4) {
            return { isJunk: true, reason: 'junk' };
        }
    }

    // Check 6: Only single character repeated (e.g., "aaaa", "1111", "????")
    if (withoutWhitespace.length >= 3) {
        const firstChar = withoutWhitespace[0];
        if (withoutWhitespace.split('').every(char => char === firstChar)) {
            return { isJunk: true, reason: 'junk' };
        }
    }

    // Check 7: Garbled text - alternating pattern (e.g., "ababab", "121212")
    if (withoutWhitespace.length >= 6) {
        const pattern = withoutWhitespace.substring(0, 2);
        let matches = 0;
        for (let i = 0; i < withoutWhitespace.length - 1; i += 2) {
            if (withoutWhitespace.substring(i, i + 2) === pattern) {
                matches++;
            }
        }
        if (matches / (withoutWhitespace.length / 2) > 0.7) {
            return { isJunk: true, reason: 'junk' };
        }
    }

    return { isJunk: false, reason: null };
}

/**
 * Check text for both profanity and junk, return ban reason if detected
 * @param {string} text - Text to check
 * @returns {object} - { shouldBan: boolean, reason: 'profanity' | 'junk' | null }
 */
function checkContent(text) {
    // Check profanity first (higher priority)
    if (containsProfanity(text)) {
        return { shouldBan: true, reason: 'profanity' };
    }

    // Check for junk
    const junkCheck = isJunk(text);
    if (junkCheck.isJunk) {
        return { shouldBan: true, reason: junkCheck.reason || 'junk' };
    }

    return { shouldBan: false, reason: null };
}

module.exports = {
    containsProfanity,
    isJunk,
    checkContent,
    getWordCount,
    getSupportedLanguages,
    // Expose the set for advanced usage if needed
    profanitySet
};

