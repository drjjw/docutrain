/**
 * Test profanity filter against evasion techniques
 * Run with: node scripts/test-evasion-detection.js
 */

const { checkContent } = require('../lib/utils/profanity-filter');

const evasionTests = [
    // Leet speak
    { text: 'f*ck', expected: true, category: 'Leet speak' },
    { text: 'f*ck you', expected: true, category: 'Leet speak' },
    { text: 'sh1t', expected: true, category: 'Leet speak' },
    { text: 'sh!t', expected: true, category: 'Leet speak' },
    { text: 'f*cking', expected: true, category: 'Leet speak' },
    { text: 'b1tch', expected: true, category: 'Leet speak' },
    { text: 'a$$', expected: true, category: 'Leet speak' },
    { text: 'a$$hole', expected: true, category: 'Leet speak' },
    
    // Character substitution (should be detected as profanity)
    { text: 'f_u_c_k', expected: true, category: 'Underscores' },
    { text: 'f-u-c-k', expected: true, category: 'Hyphens' },
    { text: 'f.u.c.k', expected: true, category: 'Dots' },
    
    // Spacing (should be detected as profanity)
    { text: 'f u c k', expected: true, category: 'Spacing' },
    { text: 'f  u  c  k', expected: true, category: 'Spacing' },
    
    // Mixed case
    { text: 'FuCk', expected: true, category: 'Mixed case' },
    { text: 'FUCK', expected: true, category: 'Uppercase' },
    { text: 'fuck', expected: true, category: 'Lowercase' },
    
    // Partial words
    { text: 'what the f', expected: false, category: 'Partial' },
    { text: 'what the f*ck', expected: true, category: 'Partial leet' },
    
    // In sentences
    { text: 'go f*ck yourself', expected: true, category: 'In sentence' },
    { text: 'this is sh1t', expected: true, category: 'In sentence' },
    { text: 'you are an a$$hole', expected: true, category: 'In sentence' },
    
    // Legitimate words that might be confused
    { text: 'class', expected: false, category: 'False positive' },
    { text: 'assistant', expected: false, category: 'False positive' },
    { text: 'consult', expected: false, category: 'False positive' },
    { text: 'documentation', expected: false, category: 'False positive' },
    
    // Common profanity
    { text: 'fuck', expected: true, category: 'Direct' },
    { text: 'shit', expected: true, category: 'Direct' },
    { text: 'asshole', expected: true, category: 'Direct' },
    { text: 'bitch', expected: true, category: 'Direct' },
];

console.log('🧪 Testing Evasion Detection\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;
const results = {
    passed: [],
    failed: [],
};

evasionTests.forEach((test, i) => {
    const result = checkContent(test.text);
    const shouldBan = result.shouldBan;
    const matches = shouldBan === test.expected;
    
    if (matches) {
        passed++;
        results.passed.push({ ...test, actual: shouldBan });
    } else {
        failed++;
        results.failed.push({ ...test, actual: shouldBan, reason: result.reason });
        console.log(`❌ Test ${i + 1}: "${test.text}"`);
        console.log(`   Category: ${test.category}`);
        console.log(`   Expected: ${test.expected ? 'BANNED' : 'ALLOWED'}, Got: ${shouldBan ? 'BANNED' : 'ALLOWED'}`);
        if (shouldBan) {
            console.log(`   Reason: ${result.reason}`);
        }
        console.log('');
    }
});

console.log('='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${evasionTests.length} tests\n`);

if (failed > 0) {
    console.log('⚠️  EVASION DETECTION GAPS:\n');
    console.log('The filter does NOT currently detect:');
    results.failed.forEach(f => {
        if (f.expected && !f.actual) {
            console.log(`  - ${f.category}: "${f.text}" (should be banned but isn't)`);
        }
    });
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   Consider adding normalization for:');
    console.log('   1. Leet speak (f*ck -> fuck, sh1t -> shit)');
    console.log('   2. Character substitution (f_u_c_k -> fuck)');
    console.log('   3. Spacing (f u c k -> fuck)');
}

if (failed === 0) {
    console.log('🎉 All tests passed!');
} else {
    console.log(`\n⚠️  ${failed} evasion techniques not detected`);
}

process.exit(failed === 0 ? 0 : 1);

