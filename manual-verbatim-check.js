/**
 * Manual verification of verbatim ratio calculation
 * Checks actual word counts and verifies the math
 */

// From Test 1 results
const aiResponse = `To screen for chronic kidney disease (CKD) in patients with diabetes, both an **estimated Glomerular Filtration Rate (eGFR)** and a **random urine albumin to creatinine ratio (ACR)** are used annually [1], [2].

**Screening Methods and Frequency**:
*   **Tests**: Screening involves measuring serum creatinine, which is then converted into an eGFR, and performing a random urine ACR [1], [3], [4]. The random urine ACR is the test of choice for screening for albuminuria [5], [6].
*   **Frequency**: Individuals with diabetes and no history of kidney disease should be screened annually [1], [7].

**Timing for Screening Initiation**:
*   **Type 1 Diabetes**: Screening should begin 5 years after the onset of diabetes, or after puberty if the onset is at an early age [1], [7].
*   **Type 2 Diabetes**: Screening should commence immediately at the time of diagnosis and annually thereafter [1], [7], [8].

**Confirmation of Diagnosis**:
*   A diagnosis of CKD is made if there is a persistent decrease in eGFR of <60 mL/min per 1.73 m² and/or persistently elevated albuminuria (ACR ≥2.0 mg/mmol) [9], [10], [11].
*   **Persistence** of elevated albuminuria requires at least 2 out of 3 urine samples to show elevated albumin levels over a 3-month period [5], [10], [12].
*   An abnormal screening test (e.g., low eGFR or abnormal random urine ACR) should be confirmed by retesting the eGFR in three months, and obtaining up to two more random urine ACRs during that interval [13].
*   If the eGFR remains low or at least two of the three random urine ACRs are abnormal, a diagnosis of CKD is confirmed [13].
*   The only exception is when the random urine ACR indicates albuminuria in the overt kidney disease range (≥20.0 mg/mmol/L), as this level rarely resolves spontaneously, typically making repeat testing unnecessary [14].
*   Screening for CKD should be delayed in the presence of conditions that can cause transient albuminuria or a temporary fall in eGFR, as these abnormal levels should not be considered diagnostic of CKD [15], [16].
*   The ACR threshold for diagnosing A2 albuminuria in individuals with diabetes is 2.0 mg/mmol [17], [18].`;

const chunk865 = `s having albuminuria requires the elevated urinary albumin level to be persistent. At least 2 out
of 3 urine samples exhibiting elevations in urinary albumin levels over 3 months are required before it is considered to be abnormal ( Figure 3).
Figure 3
A flowchart for screening for CKD in people wit...`;

// Count words
const responseWords = aiResponse.toLowerCase().split(/\s+/);
const chunkWords = chunk865.toLowerCase().split(/\s+/);

console.log('📊 WORD COUNT ANALYSIS');
console.log('='.repeat(80));
console.log(`AI Response: ${responseWords.length} words`);
console.log(`Chunk 865: ${chunkWords.length} words (first 300 chars)`);
console.log(`Max length: ${Math.max(responseWords.length, chunkWords.length)}`);
console.log('');

// Find longest match (current method)
let maxMatch = 0;
for (let i = 0; i < responseWords.length; i++) {
    for (let j = 0; j < chunkWords.length; j++) {
        let match = 0;
        let k = 0;
        while (i + k < responseWords.length && 
               j + k < chunkWords.length && 
               responseWords[i + k] === chunkWords[j + k]) {
            match++;
            k++;
        }
        if (match > maxMatch) {
            maxMatch = match;
        }
    }
}

console.log('🔍 CURRENT METHOD ANALYSIS:');
console.log(`Longest consecutive match: ${maxMatch} words`);
console.log(`Using max(length): ${maxMatch} / ${Math.max(responseWords.length, chunkWords.length)} = ${(maxMatch / Math.max(responseWords.length, chunkWords.length) * 100).toFixed(2)}%`);
console.log(`Using response length: ${maxMatch} / ${responseWords.length} = ${(maxMatch / responseWords.length * 100).toFixed(2)}%`);
console.log('');

// Find ALL verbatim phrases
console.log('🔍 IMPROVED METHOD: Find ALL verbatim phrases');
const phrases = [];
const usedIndices = new Set();

for (let i = 0; i < responseWords.length; i++) {
    if (usedIndices.has(i)) continue;
    
    for (let j = 0; j < chunkWords.length; j++) {
        let matchLength = 0;
        let k = 0;
        
        while (i + k < responseWords.length && 
               j + k < chunkWords.length && 
               responseWords[i + k] === chunkWords[j + k]) {
            matchLength++;
            k++;
        }
        
        if (matchLength >= 3) {
            for (let m = 0; m < matchLength; m++) {
                usedIndices.add(i + m);
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

const totalVerbatimWords = phrases.reduce((sum, p) => sum + p.length, 0);

console.log(`Total verbatim phrases found: ${phrases.length}`);
console.log(`Total verbatim words: ${totalVerbatimWords}`);
console.log(`Response-based ratio: ${(totalVerbatimWords / responseWords.length * 100).toFixed(2)}%`);
console.log('');
console.log('Sample phrases:');
phrases.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.words}" (${p.length} words)`);
});

console.log('');
console.log('⚠️  KEY FINDING:');
if (totalVerbatimWords / responseWords.length > maxMatch / responseWords.length) {
    const diff = ((totalVerbatimWords / responseWords.length) - (maxMatch / responseWords.length)) * 100;
    console.log(`The improved method finds ${diff.toFixed(1)}% MORE verbatim content!`);
    console.log(`Current method underestimates verbatim copying.`);
} else {
    console.log(`Both methods find similar results.`);
}



