/**
 * Debug script to see what profanity words are matching
 * Run with: node scripts/debug-profanity-matches.js
 */

const { containsProfanity, profanitySet } = require('../lib/utils/profanity-filter');

// Test the problematic questions
const testQuestions = [
    "Tell me about Consult Team",
    "tell me about the conch",
    "What is the suggested approach for discussing obesity with a patient?",
    "Tell me about ICU",
    "Tell me about competitive advantage",
    "Tell me about Documentation Expectations",
    "What about access control to the",
    "Tell me about culture-negative infection",
    "What is the dose of cefazolin in PD-associated peritonitis?",
    "convert 5 mg prednisone to hydrocortisone",
    "Tell me about vasculitis",
    "What is Podocytopathy",
    "what about nsMRAs?",
];

console.log('🔍 Debugging Profanity Matches\n');
console.log('='.repeat(80));

testQuestions.forEach(question => {
    console.log(`\nQuestion: "${question}"`);
    console.log(`Flagged: ${containsProfanity(question)}`);
    
    // Try to find what's matching
    const normalized = question.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ');
    const words = normalized.split(/\s+/);
    
    const matches = [];
    for (const word of words) {
        // Check direct match
        if (profanitySet.has(word)) {
            matches.push(`Direct match: "${word}"`);
        }
        
        // Check substring matches
        for (const profanity of profanitySet) {
            if (profanity.length >= 3) {
                if (word.includes(profanity)) {
                    matches.push(`"${word}" contains "${profanity}"`);
                }
                if (profanity.includes(word) && word.length >= 3) {
                    matches.push(`"${profanity}" contains "${word}"`);
                }
            }
        }
    }
    
    // Check full text
    for (const profanity of profanitySet) {
        if (profanity.length >= 3 && normalized.includes(profanity)) {
            if (!matches.some(m => m.includes(profanity))) {
                matches.push(`Full text contains "${profanity}"`);
            }
        }
    }
    
    if (matches.length > 0) {
        console.log('Matches found:');
        matches.slice(0, 5).forEach(m => console.log(`  - ${m}`));
        if (matches.length > 5) {
            console.log(`  ... and ${matches.length - 5} more`);
        }
    } else {
        console.log('No matches found (but still flagged - check logic)');
    }
});

console.log('\n' + '='.repeat(80));
console.log('\n📊 Profanity set size:', profanitySet.size);
console.log('\nSample profanity words (first 20):');
Array.from(profanitySet).slice(0, 20).forEach(word => console.log(`  - ${word}`));

