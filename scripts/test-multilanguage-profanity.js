/**
 * Test Multi-Language Profanity Filter
 */

const { containsProfanity } = require('../lib/utils/profanity-filter');

console.log("=".repeat(90));
console.log("MULTI-LANGUAGE PROFANITY FILTER TEST");
console.log("=".repeat(90));
console.log();

// Test cases in different languages
const testCases = [
    // English
    { text: "What is the treatment?", category: "Clean (EN)" },
    { text: "Fuck you", category: "Profanity (EN)" },
    { text: "This is bullshit", category: "Profanity (EN)" },
    
    // Spanish
    { text: "¿Cuál es el tratamiento?", category: "Clean (ES)" },
    { text: "joder esto", category: "Profanity (ES)" },
    { text: "cabrón", category: "Profanity (ES)" },
    
    // French
    { text: "Quel est le traitement?", category: "Clean (FR)" },
    { text: "merde", category: "Profanity (FR)" },
    { text: "putain", category: "Profanity (FR)" },
    
    // German
    { text: "Was ist die Behandlung?", category: "Clean (DE)" },
    { text: "scheiße", category: "Profanity (DE)" },
    { text: "ficken", category: "Profanity (DE)" },
    
    // Italian
    { text: "Qual è il trattamento?", category: "Clean (IT)" },
    { text: "cazzo", category: "Profanity (IT)" },
    
    // Portuguese
    { text: "Qual é o tratamento?", category: "Clean (PT)" },
    { text: "porra", category: "Profanity (PT)" },
    
    // Russian (Cyrillic)
    { text: "Какое лечение?", category: "Clean (RU)" },
    { text: "блять", category: "Profanity (RU)" },
    
    // Chinese
    { text: "治疗是什么?", category: "Clean (ZH)" },
    
    // Japanese
    { text: "治療は何ですか?", category: "Clean (JA)" },
    
    // Korean
    { text: "치료는 무엇입니까?", category: "Clean (KO)" },
    
    // Hindi
    { text: "उपचार क्या है?", category: "Clean (HI)" },
    
    // Arabic
    { text: "ما هو العلاج?", category: "Clean (AR)" },
];

let flagged = 0;
let clean = 0;

testCases.forEach((testCase, index) => {
    const result = containsProfanity(testCase.text);
    const status = result ? "🚫 FLAGGED" : "✅ CLEAN";
    
    if (result) flagged++;
    else clean++;
    
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




