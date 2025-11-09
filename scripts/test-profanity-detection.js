/**
 * Profanity Detection Test Script
 * Tests the profanity detection logic without inserting into database
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

// Test cases - mixing profanity, evasion techniques, and clean content
const testCases = [
    // Clean/legitimate content
    { text: "What is the treatment for kidney disease?", expected: false },
    { text: "Can you explain the KDIGO guidelines?", expected: false },
    { text: "I need help understanding dialysis options", expected: false },
    { text: "What are the side effects of this medication?", expected: false },
    { text: "How does this procedure work?", expected: false },
    { text: "Please provide more information", expected: false },
    { text: "Thank you for your help", expected: false },
    
    // Obvious profanity
    { text: "What the hell is this?", expected: true },
    { text: "This is bullshit", expected: true },
    { text: "That's fucking ridiculous", expected: true },
    { text: "You're an asshole", expected: true },
    { text: "Damn it", expected: true },
    
    // Evasion techniques - leetspeak
    { text: "What the h3ll is this?", expected: true },
    { text: "This is bullsh1t", expected: true },
    { text: "That's f*cking ridiculous", expected: true },
    { text: "You're an @sshole", expected: true },
    { text: "D@mn it", expected: true },
    
    // Evasion techniques - spacing
    { text: "What the h e l l is this?", expected: true },
    { text: "This is b u l l s h i t", expected: true },
    { text: "That's f u c k i n g ridiculous", expected: true },
    
    // Evasion techniques - mixed case
    { text: "What the HeLL is this?", expected: true },
    { text: "This is BuLlShIt", expected: true },
    { text: "That's FuCkInG ridiculous", expected: true },
    
    // Evasion techniques - repeated characters
    { text: "What the heeeell is this?", expected: true },
    { text: "This is bullshiiit", expected: true },
    { text: "That's fuuucking ridiculous", expected: true },
    
    // Medical terms that might be flagged incorrectly (should be clean)
    { text: "What is the anatomy of the body?", expected: false },
    { text: "Explain the function of the organ", expected: false },
    { text: "What are the symptoms?", expected: false },
    
    // Edge cases
    { text: "", expected: false },
    { text: "   ", expected: false },
    { text: "Hello world", expected: false },
    { text: "Test question about medical procedures", expected: false },
    
    // Profanity in context (should still be caught)
    { text: "I have a question about kidney function, but this is bullshit", expected: true },
    { text: "What is dialysis? Also, you're an asshole", expected: true },
    { text: "Can you help me understand this? Damn it, I'm confused", expected: true },
    
    // Subtle profanity
    { text: "This is crap", expected: true },
    { text: "That's stupid", expected: false }, // "stupid" is not in bad-words default list
    { text: "You're an idiot", expected: false }, // "idiot" is not in bad-words default list
    
    // Multiple profanity words
    { text: "This is fucking bullshit and you're an asshole", expected: true },
    { text: "Hell yeah, this is damn good", expected: true },
    
    // Profanity with punctuation
    { text: "What the hell?!", expected: true },
    { text: "This is bullshit!", expected: true },
    { text: "F*** you!", expected: true },
    
    // Long text with profanity
    { text: "I have a question about kidney disease treatment options and I need to understand the guidelines better because this is really important to me and I want to make sure I'm doing the right thing but honestly this is bullshit", expected: true },
    
    // Long clean text
    { text: "I have a question about kidney disease treatment options and I need to understand the guidelines better because this is really important to me and I want to make sure I'm doing the right thing for my health", expected: false },
    
    // Racial slurs and hate speech (should be flagged)
    { text: "What is the n-word?", expected: true },
    { text: "Can you explain this to me?", expected: false }, // Clean question
    { text: "I need help with this", expected: false }, // Clean question
    { text: "This is a test", expected: false }, // Clean
    { text: "What are the guidelines?", expected: false }, // Clean
];

console.log("=".repeat(80));
console.log("PROFANITY DETECTION TEST RESULTS");
console.log("=".repeat(80));
console.log();

let passed = 0;
let failed = 0;
let total = testCases.length;

testCases.forEach((testCase, index) => {
    const result = containsProfanity(testCase.text);
    const status = result === testCase.expected ? "✅ PASS" : "❌ FAIL";
    const flagStatus = result ? "🚫 FLAGGED" : "✅ CLEAN";
    
    if (result === testCase.expected) {
        passed++;
    } else {
        failed++;
    }
    
    console.log(`Test ${index + 1}: ${status} | ${flagStatus}`);
    console.log(`  Text: "${testCase.text.substring(0, 70)}${testCase.text.length > 70 ? '...' : ''}"`);
    console.log(`  Expected: ${testCase.expected ? 'FLAGGED' : 'CLEAN'} | Got: ${result ? 'FLAGGED' : 'CLEAN'}`);
    console.log();
});

console.log("=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`Total Tests: ${total}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
console.log("=".repeat(80));

// Additional analysis
console.log();
console.log("=".repeat(80));
console.log("DETAILED ANALYSIS");
console.log("=".repeat(80));

const flagged = testCases.filter(tc => containsProfanity(tc.text));
const clean = testCases.filter(tc => !containsProfanity(tc.text));

console.log(`\n🚫 FLAGGED (${flagged.length} tests):`);
flagged.forEach((tc, i) => {
    console.log(`  ${i + 1}. "${tc.text.substring(0, 60)}${tc.text.length > 60 ? '...' : ''}"`);
});

console.log(`\n✅ CLEAN (${clean.length} tests):`);
clean.forEach((tc, i) => {
    console.log(`  ${i + 1}. "${tc.text.substring(0, 60)}${tc.text.length > 60 ? '...' : ''}"`);
});

console.log();
console.log("=".repeat(80));
console.log("TEST COMPLETE");
console.log("=".repeat(80));

