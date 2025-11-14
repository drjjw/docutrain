/**
 * Verify the verbatim analysis for Chunk 865 example
 */

const chunk = `s having albuminuria requires the elevated urinary albumin level to be persistent. At least 2 out
of 3 urine samples exhibiting elevations in urinary albumin levels over 3 months are required before it is considered to be abnormal ( Figure 3).
Figure 3
A flowchart for screening for CKD in people wit...`;

const aiResponse = `**Persistence** of elevated albuminuria requires at least 2 out of 3 urine samples to show elevated albumin levels over a 3-month period [5], [10], [12].`;

function findAllVerbatimPhrases(response, chunk, minPhraseLength = 3) {
    const responseWords = response.toLowerCase().split(/\s+/);
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    
    const phrases = [];
    const usedResponseIndices = new Set();
    
    for (let i = 0; i < responseWords.length; i++) {
        if (usedResponseIndices.has(i)) continue;
        
        for (let j = 0; j < chunkWords.length; j++) {
            let matchLength = 0;
            let k = 0;
            
            while (i + k < responseWords.length && 
                   j + k < chunkWords.length && 
                   responseWords[i + k] === chunkWords[j + k]) {
                matchLength++;
                k++;
            }
            
            if (matchLength >= minPhraseLength) {
                for (let m = 0; m < matchLength; m++) {
                    usedResponseIndices.add(i + m);
                }
                
                phrases.push({
                    start: i,
                    length: matchLength,
                    words: responseWords.slice(i, i + matchLength).join(' ')
                });
                break;
            }
        }
    }
    
    return phrases;
}

const responseWords = aiResponse.toLowerCase().split(/\s+/);
const chunkWords = chunk.toLowerCase().split(/\s+/);

console.log('🔍 VERBATIM ANALYSIS - Chunk 865 Example');
console.log('='.repeat(80));
console.log('\nChunk (first 200 chars):');
console.log(chunk.substring(0, 200));
console.log('\nAI Response:');
console.log(aiResponse);
console.log('\n' + '='.repeat(80));

const phrases = findAllVerbatimPhrases(aiResponse, chunk, 3);
const totalVerbatimWords = phrases.reduce((sum, p) => sum + p.length, 0);

console.log(`\nResponse words: ${responseWords.length}`);
console.log(`Chunk words: ${chunkWords.length}`);
console.log(`\nVerbatim phrases found: ${phrases.length}`);
console.log(`Total verbatim words: ${totalVerbatimWords}`);
console.log(`Response-based ratio: ${(totalVerbatimWords / responseWords.length * 100).toFixed(2)}%`);

console.log('\n📝 All verbatim phrases:');
phrases.forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.words}" (${p.length} words)`);
});

// Also check individual word matches
const chunkWordSet = new Set(chunkWords);
const matchingWords = responseWords.filter(w => chunkWordSet.has(w));
console.log(`\n📊 Individual word matches: ${matchingWords.length}/${responseWords.length} (${(matchingWords.length / responseWords.length * 100).toFixed(1)}%)`);
console.log('Matching words:', matchingWords.join(', '));


