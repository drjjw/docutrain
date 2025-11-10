/**
 * Test Custom Profanity Filter using naughty-words
 */

const { containsProfanity, getWordCount, getSupportedLanguages } = require('../lib/utils/profanity-filter');

console.log("=".repeat(90));
console.log("CUSTOM PROFANITY FILTER TEST (using naughty-words)");
console.log("=".repeat(90));
console.log(`Word count: ${getWordCount()}`);
console.log(`Supported languages: ${getSupportedLanguages().join(', ')}`);
console.log();

// Test cases
const testCases = [
    // Clean medical content
    { text: "What is the treatment for kidney disease?", category: "Clean" },
    { text: "Can you explain dialysis?", category: "Clean" },
    { text: "What are the guidelines?", category: "Clean" },
    { text: "I need help understanding this", category: "Clean" },
    
    // Common profanity
    { text: "What the hell is this?", category: "Profanity" },
    { text: "That's fucking ridiculous", category: "Profanity" },
    { text: "You're an asshole", category: "Profanity" },
    { text: "This is bullshit", category: "Profanity" },
    { text: "Damn it", category: "Profanity" },
    { text: "Fuck you", category: "Profanity" },
    
    // Euphemisms
    { text: "What is the n-word?", category: "Euphemism" },
    { text: "Can you explain the n word?", category: "Euphemism" },
    
    // Racial slurs (using asterisks - these won't be caught, but testing structure)
    { text: "You are a n****r", category: "Racial Slur (masked)" },
    { text: "That person is a n****r", category: "Racial Slur (masked)" },
    
    // Hate speech
    { text: "I hate black people", category: "Hate Speech" },
    { text: "All Asians are bad", category: "Hate Speech" },
    
    // Evasion techniques
    { text: "What the h3ll is this?", category: "Evasion" },
    { text: "This is bullsh1t", category: "Evasion" },
    { text: "That's f*cking ridiculous", category: "Evasion" },
];

console.log("Running tests...\n");

let flagged = 0;
let clean = 0;
const flaggedList = [];
const cleanList = [];

testCases.forEach((testCase, index) => {
    const result = containsProfanity(testCase.text);
    const status = result ? "🚫 FLAGGED" : "✅ CLEAN";
    
    if (result) {
        flagged++;
        flaggedList.push({ ...testCase, index: index + 1 });
    } else {
        clean++;
        cleanList.push({ ...testCase, index: index + 1 });
    }
    
    console.log(`Test ${index + 1}: ${status} | [${testCase.category}]`);
    console.log(`  Text: "${testCase.text}"`);
    console.log();
});

console.log("=".repeat(90));
console.log("SUMMARY");
console.log("=".repeat(90));
console.log(`Total Tests: ${testCases.length}`);
console.log(`🚫 Flagged: ${flagged} (${((flagged / testCases.length) * 100).toFixed(1)}%)`);
console.log(`✅ Clean: ${clean} (${((clean / testCases.length) * 100).toFixed(1)}%)`);
console.log("=".repeat(90));

console.log();
console.log("=".repeat(90));
console.log("🚫 FLAGGED ITEMS:");
console.log("=".repeat(90));
flaggedList.forEach((item) => {
    console.log(`  ${item.index}. [${item.category}] "${item.text}"`);
});

console.log();
console.log("=".repeat(90));
console.log("✅ CLEAN ITEMS:");
console.log("=".repeat(90));
cleanList.forEach((item) => {
    const marker = item.category === "Clean" ? "✓" : "⚠️";
    console.log(`  ${marker} ${item.index}. [${item.category}] "${item.text}"`);
});

console.log();
console.log("=".repeat(90));
console.log("TEST COMPLETE");
console.log("=".repeat(90));



