/**
 * Compare curse-filter vs bad-words for racial slur detection
 * Tests multilingual profanity detection
 */

const Filter = require('bad-words');
const curseFilter = require('curse-filter');

const badWordsFilter = new Filter();

/**
 * Check text with bad-words library
 */
function checkBadWords(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    try {
        return badWordsFilter.isProfane(text);
    } catch (error) {
        return false;
    }
}

/**
 * Check text with curse-filter library (async)
 */
async function checkCurseFilter(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    try {
        // curse-filter detect is async and returns a boolean
        const result = await curseFilter.detect(text);
        return result === true;
    } catch (error) {
        return false;
    }
}

// Test cases - racial slurs, hate speech, and clean content
const testCases = [
    // Racial slurs (using asterisks to mask)
    { text: "You are a n****r", category: "Racial Slur" },
    { text: "That person is a n****r", category: "Racial Slur" },
    { text: "I hate n****rs", category: "Racial Slur" },
    { text: "You are a k***e", category: "Racial Slur" },
    { text: "Those c****ks are bad", category: "Racial Slur" },
    { text: "I don't like s****s", category: "Racial Slur" },
    { text: "Those w****s are terrible", category: "Racial Slur" },
    
    // Euphemisms
    { text: "What is the n-word?", category: "Euphemism" },
    { text: "Can you explain the n word?", category: "Euphemism" },
    
    // Hate speech
    { text: "I hate black people", category: "Hate Speech" },
    { text: "All Asians are bad", category: "Hate Speech" },
    { text: "White people are superior", category: "Hate Speech" },
    { text: "Jews control everything", category: "Hate Speech" },
    
    // Common profanity (for comparison)
    { text: "What the hell is this?", category: "Profanity" },
    { text: "That's fucking ridiculous", category: "Profanity" },
    { text: "You're an asshole", category: "Profanity" },
    { text: "This is bullshit", category: "Profanity" },
    { text: "Damn it", category: "Profanity" },
    
    // Clean medical content
    { text: "What is the treatment for kidney disease?", category: "Clean" },
    { text: "Can you explain dialysis?", category: "Clean" },
    { text: "What are the guidelines?", category: "Clean" },
    { text: "I need help understanding this", category: "Clean" },
];

(async () => {
console.log("=".repeat(90));
console.log("COMPARISON: curse-filter vs bad-words");
console.log("=".repeat(90));
console.log();

let badWordsFlagged = 0;
let curseFilterFlagged = 0;
let bothFlagged = 0;
let onlyBadWords = 0;
let onlyCurseFilter = 0;
let neitherFlagged = 0;

const results = [];

// Process tests with async curse-filter
for (let index = 0; index < testCases.length; index++) {
    const testCase = testCases[index];
    const badWordsResult = checkBadWords(testCase.text);
    const curseFilterResult = await checkCurseFilter(testCase.text);
    
    if (badWordsResult) badWordsFlagged++;
    if (curseFilterResult) curseFilterFlagged++;
    if (badWordsResult && curseFilterResult) bothFlagged++;
    if (badWordsResult && !curseFilterResult) onlyBadWords++;
    if (!badWordsResult && curseFilterResult) onlyCurseFilter++;
    if (!badWordsResult && !curseFilterResult) neitherFlagged++;
    
    results.push({
        ...testCase,
        index: index + 1,
        badWords: badWordsResult,
        curseFilter: curseFilterResult
    });
    
    const badWordsStatus = badWordsResult ? "🚫" : "✅";
    const curseFilterStatus = curseFilterResult ? "🚫" : "✅";
    
    console.log(`Test ${index + 1}: [${testCase.category}]`);
    console.log(`  Text: "${testCase.text}"`);
    console.log(`  bad-words: ${badWordsStatus} | curse-filter: ${curseFilterStatus}`);
    console.log();
}

console.log("=".repeat(90));
console.log("SUMMARY");
console.log("=".repeat(90));
console.log(`Total Tests: ${testCases.length}`);
console.log();
console.log(`bad-words flagged: ${badWordsFlagged} (${((badWordsFlagged / testCases.length) * 100).toFixed(1)}%)`);
console.log(`curse-filter flagged: ${curseFilterFlagged} (${((curseFilterFlagged / testCases.length) * 100).toFixed(1)}%)`);
console.log(`Both flagged: ${bothFlagged}`);
console.log(`Only bad-words: ${onlyBadWords}`);
console.log(`Only curse-filter: ${onlyCurseFilter}`);
console.log(`Neither flagged: ${neitherFlagged}`);
console.log("=".repeat(90));

console.log();
console.log("=".repeat(90));
console.log("DETAILED BREAKDOWN BY CATEGORY");
console.log("=".repeat(90));

const categories = [...new Set(testCases.map(tc => tc.category))];
categories.forEach(category => {
    const categoryTests = results.filter(r => r.category === category);
    const badWordsCount = categoryTests.filter(r => r.badWords).length;
    const curseFilterCount = categoryTests.filter(r => r.curseFilter).length;
    
    console.log(`\n${category} (${categoryTests.length} tests):`);
    console.log(`  bad-words: ${badWordsCount}/${categoryTests.length} flagged`);
    console.log(`  curse-filter: ${curseFilterCount}/${categoryTests.length} flagged`);
    
    // Show which ones each caught
    const onlyBadWordsInCategory = categoryTests.filter(r => r.badWords && !r.curseFilter);
    const onlyCurseFilterInCategory = categoryTests.filter(r => !r.badWords && r.curseFilter);
    const bothInCategory = categoryTests.filter(r => r.badWords && r.curseFilter);
    const neitherInCategory = categoryTests.filter(r => !r.badWords && !r.curseFilter);
    
    if (onlyBadWordsInCategory.length > 0) {
        console.log(`  Only bad-words caught:`);
        onlyBadWordsInCategory.forEach(r => console.log(`    - "${r.text}"`));
    }
    if (onlyCurseFilterInCategory.length > 0) {
        console.log(`  Only curse-filter caught:`);
        onlyCurseFilterInCategory.forEach(r => console.log(`    - "${r.text}"`));
    }
    if (bothInCategory.length > 0) {
        console.log(`  Both caught:`);
        bothInCategory.forEach(r => console.log(`    - "${r.text}"`));
    }
    if (neitherInCategory.length > 0 && category !== "Clean") {
        console.log(`  ⚠️  Neither caught:`);
        neitherInCategory.forEach(r => console.log(`    - "${r.text}"`));
    }
});

console.log();
console.log("=".repeat(90));
console.log("RECOMMENDATION");
console.log("=".repeat(90));

if (curseFilterFlagged > badWordsFlagged) {
    console.log("✅ curse-filter appears to catch MORE profanity than bad-words");
    console.log(`   Difference: ${curseFilterFlagged - badWordsFlagged} more detections`);
} else if (badWordsFlagged > curseFilterFlagged) {
    console.log("✅ bad-words appears to catch MORE profanity than curse-filter");
    console.log(`   Difference: ${badWordsFlagged - curseFilterFlagged} more detections`);
} else {
    console.log("⚠️  Both libraries catch similar amounts");
}

const racialSlurTests = results.filter(r => r.category === "Racial Slur");
const racialSlursCaughtByCurseFilter = racialSlurTests.filter(r => r.curseFilter).length;
const racialSlursCaughtByBadWords = racialSlurTests.filter(r => r.badWords).length;

console.log();
console.log(`Racial Slur Detection:`);
console.log(`  curse-filter: ${racialSlursCaughtByCurseFilter}/${racialSlurTests.length} caught`);
console.log(`  bad-words: ${racialSlursCaughtByBadWords}/${racialSlurTests.length} caught`);

if (racialSlursCaughtByCurseFilter > racialSlursCaughtByBadWords) {
    console.log("  ✅ curse-filter is BETTER at catching racial slurs");
} else if (racialSlursCaughtByBadWords > racialSlursCaughtByCurseFilter) {
    console.log("  ✅ bad-words is BETTER at catching racial slurs");
} else {
    console.log("  ⚠️  Both perform similarly (likely both miss them)");
}

console.log();
console.log("=".repeat(90));
console.log("TEST COMPLETE");
console.log("=".repeat(90));
})();

