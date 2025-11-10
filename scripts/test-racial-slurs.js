/**
 * Racial Slur Detection Test Script
 * Tests if racial slurs are caught by the profanity filter
 */

const Filter = require('bad-words');
const filter = new Filter();

/**
 * Check text for profanity (same logic as API endpoint)
 */
function containsProfanity(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    try {
        return filter.isProfane(text);
    } catch (error) {
        console.error('Error checking profanity:', error);
        return false;
    }
}

// Test cases specifically for racial slurs and hate speech
const racialSlurTests = [
    // Euphemisms (might not be caught)
    { text: "What is the n-word?", category: "Euphemism" },
    { text: "Can you explain the n word?", category: "Euphemism" },
    { text: "What does the n-word mean?", category: "Euphemism" },
    
    // Actual racial slurs (using asterisks to mask - testing if library catches them)
    { text: "You are a n****r", category: "Racial Slur" },
    { text: "That person is a n****r", category: "Racial Slur" },
    { text: "I hate n****rs", category: "Racial Slur" },
    
    // Other racial slurs
    { text: "You are a k***e", category: "Racial Slur" },
    { text: "Those c****ks are bad", category: "Racial Slur" },
    { text: "I don't like s****s", category: "Racial Slur" },
    { text: "Those w****s are terrible", category: "Racial Slur" },
    { text: "You're a c****k", category: "Racial Slur" },
    
    // Hate speech phrases
    { text: "I hate black people", category: "Hate Speech" },
    { text: "All Asians are bad", category: "Hate Speech" },
    { text: "White people are superior", category: "Hate Speech" },
    { text: "Jews control everything", category: "Hate Speech" },
    
    // Clean medical questions (should pass)
    { text: "What is the treatment for kidney disease?", category: "Clean" },
    { text: "Can you explain dialysis?", category: "Clean" },
    { text: "What are the guidelines?", category: "Clean" },
    { text: "I need help understanding this", category: "Clean" },
    
    // Common profanity (for comparison)
    { text: "What the hell is this?", category: "Profanity" },
    { text: "That's fucking ridiculous", category: "Profanity" },
    { text: "You're an asshole", category: "Profanity" },
];

console.log("=".repeat(80));
console.log("RACIAL SLUR & HATE SPEECH DETECTION TEST");
console.log("=".repeat(80));
console.log();

let flagged = 0;
let clean = 0;
const flaggedList = [];
const cleanList = [];

racialSlurTests.forEach((testCase, index) => {
    const result = containsProfanity(testCase.text);
    const status = result ? "🚫 FLAGGED" : "✅ CLEAN";
    
    if (result) {
        flagged++;
        flaggedList.push({ ...testCase, index: index + 1 });
    } else {
        clean++;
        cleanList.push({ ...testCase, index: index + 1 });
    }
    
    console.log(`Test ${index + 1}: ${status} | Category: ${testCase.category}`);
    console.log(`  Text: "${testCase.text}"`);
    console.log();
});

console.log("=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`Total Tests: ${racialSlurTests.length}`);
console.log(`🚫 Flagged: ${flagged} (${((flagged / racialSlurTests.length) * 100).toFixed(1)}%)`);
console.log(`✅ Clean: ${clean} (${((clean / racialSlurTests.length) * 100).toFixed(1)}%)`);
console.log("=".repeat(80));

console.log();
console.log("=".repeat(80));
console.log("🚫 FLAGGED ITEMS (${flagged}):");
console.log("=".repeat(80));
flaggedList.forEach((item) => {
    console.log(`  ${item.index}. [${item.category}] "${item.text}"`);
});

console.log();
console.log("=".repeat(80));
console.log("✅ CLEAN ITEMS (${clean}) - POTENTIALLY MISSED:");
console.log("=".repeat(80));
cleanList.forEach((item) => {
    if (item.category !== "Clean") {
        console.log(`  ⚠️  ${item.index}. [${item.category}] "${item.text}"`);
    } else {
        console.log(`  ✓ ${item.index}. [${item.category}] "${item.text}"`);
    }
});

console.log();
console.log("=".repeat(80));
console.log("ANALYSIS");
console.log("=".repeat(80));

const missedSlurs = cleanList.filter(item => item.category.includes("Slur") || item.category.includes("Hate"));
const missedEuphemisms = cleanList.filter(item => item.category === "Euphemism");

if (missedSlurs.length > 0) {
    console.log(`\n⚠️  WARNING: ${missedSlurs.length} racial slur(s) were NOT flagged:`);
    missedSlurs.forEach(item => {
        console.log(`     - "${item.text}"`);
    });
}

if (missedEuphemisms.length > 0) {
    console.log(`\n⚠️  NOTE: ${missedEuphemisms.length} euphemism(s) were NOT flagged (this may be expected):`);
    missedEuphemisms.forEach(item => {
        console.log(`     - "${item.text}"`);
    });
}

console.log();
console.log("=".repeat(80));
console.log("TEST COMPLETE");
console.log("=".repeat(80));



