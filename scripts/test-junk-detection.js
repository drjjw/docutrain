/**
 * Test script for junk detection
 * Run with: node scripts/test-junk-detection.js
 */

const { isJunk, checkContent } = require('../lib/utils/profanity-filter');

// Test cases for junk detection
const testCases = [
    // Should be flagged as junk
    // Note: 'ab' is now allowed as 2-letter strings could be acronyms
    { text: 'a', expected: true, reason: 'Too short' },
    { text: '   ', expected: true, reason: 'Only whitespace' },
    { text: '!!!!', expected: true, reason: 'Only special chars' },
    { text: '123456', expected: true, reason: 'Only numbers' },
    { text: 'aaaaaa', expected: true, reason: 'Repeated character' },
    { text: 'asdfgh', expected: true, reason: 'Keyboard pattern' },
    { text: 'qwerty', expected: true, reason: 'Keyboard pattern' },
    { text: 'zxcvbn', expected: true, reason: 'Keyboard pattern' },
    { text: 'abababab', expected: true, reason: 'Alternating pattern' },
    { text: '12121212', expected: true, reason: 'Alternating pattern' },
    { text: '!!!@@@###', expected: true, reason: 'Mostly special chars' },
    { text: '1111111111', expected: true, reason: 'Repeated numbers' },
    
    // Should NOT be flagged as junk
    { text: 'What is diabetes?', expected: false, reason: 'Valid question' },
    { text: 'How do I treat hypertension?', expected: false, reason: 'Valid question' },
    { text: 'Explain CKD stages', expected: false, reason: 'Valid question' },
    { text: 'Test', expected: false, reason: 'Short but valid' },
    { text: 'Hi', expected: false, reason: 'Short greeting (2 chars - edge case)' },
    { text: 'What?', expected: false, reason: 'Valid short question' },
    { text: 'Why?', expected: false, reason: 'Valid short question' },
    { text: 'CKD', expected: false, reason: 'Acronym (3 chars)' },
    { text: 'DM', expected: false, reason: 'Acronym (2 chars - edge case)' },
    { text: 'What is the treatment for stage 3 CKD?', expected: false, reason: 'Long valid question' },
];

console.log('🧪 Testing Junk Detection\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    const result = isJunk(testCase.text);
    const checkResult = checkContent(testCase.text);
    
    const isJunkMatch = result.isJunk === testCase.expected;
    const checkMatch = checkResult.shouldBan === testCase.expected;
    
    if (isJunkMatch && checkMatch) {
        passed++;
        console.log(`✅ Test ${index + 1}: "${testCase.text}"`);
        console.log(`   Expected: ${testCase.expected ? 'JUNK' : 'VALID'}, Got: ${result.isJunk ? 'JUNK' : 'VALID'}`);
        console.log(`   Reason: ${testCase.reason}`);
        if (result.isJunk) {
            console.log(`   Ban reason: ${checkResult.reason}`);
        }
    } else {
        failed++;
        console.log(`❌ Test ${index + 1}: "${testCase.text}"`);
        console.log(`   Expected: ${testCase.expected ? 'JUNK' : 'VALID'}, Got: ${result.isJunk ? 'JUNK' : 'VALID'}`);
        console.log(`   Reason: ${testCase.reason}`);
        console.log(`   isJunk match: ${isJunkMatch}, checkContent match: ${checkMatch}`);
    }
    console.log('');
});

console.log('='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
} else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
}

