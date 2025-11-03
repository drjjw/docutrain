/**
 * Update year column for AJKD Core Curriculum documents
 * Extracts year from filenames and titles
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Extract year from filename
 * Patterns:
 * - --Core-Curriculum-2022_20 -> 2022
 * - --Core-Curriculum-2021_2021_yajkd -> 2021
 * - --Core-Curriculum-2009_200 -> 2009
 * - _2024_2024_yaj -> 2024
 * - -2020_2 -> 2020
 */
function extractYearFromFilename(filename) {
    if (!filename) return null;
    
    // Pattern 1: --Core-Curriculum-YYYY_* or -Core-Curriculum-YYYY_*
    const coreCurriculumMatch = filename.match(/-Core-Curriculum-(\d{4})/);
    if (coreCurriculumMatch) {
        return coreCurriculumMatch[1];
    }
    
    // Pattern 2: _YYYY_YYYY_yajkd or _YYYY_YYYY_yaj
    const duplicateYearMatch = filename.match(/_(\d{4})_\1_(?:yajkd|yaj)/);
    if (duplicateYearMatch) {
        return duplicateYearMatch[1];
    }
    
    // Pattern 3: _YYYY_YYYY_ (ending with underscore)
    const duplicateYearMatch2 = filename.match(/_(\d{4})_\1_/);
    if (duplicateYearMatch2) {
        return duplicateYearMatch2[1];
    }
    
    // Pattern 4: -YYYY_* (general pattern)
    const yearMatch = filename.match(/-(\d{4})_/);
    if (yearMatch) {
        return yearMatch[1];
    }
    
    // Pattern 5: _YYYY_* (starting with underscore)
    const yearMatch2 = filename.match(/_(\d{4})_/);
    if (yearMatch2) {
        return yearMatch2[1];
    }
    
    // Pattern 6: _YYYY_yajkd or _YYYY_yaj
    const yearMatch3 = filename.match(/_(\d{4})_(?:yajkd|yaj)/);
    if (yearMatch3) {
        return yearMatch3[1];
    }
    
    return null;
}

/**
 * Extract year from title
 * Patterns:
 * - "Core Curriculum 2021"
 * - "Core Curriculum 2016"
 */
function extractYearFromTitle(title) {
    if (!title) return null;
    
    // Pattern: "Core Curriculum YYYY"
    const match = title.match(/Core Curriculum (\d{4})/);
    if (match) {
        return match[1];
    }
    
    return null;
}

async function updateAJKDYears() {
    console.log('🔄 Fetching AJKD documents...');
    
    // Get all AJKD documents
    const { data: documents, error } = await supabase
        .from('documents')
        .select('id, slug, title, pdf_filename, year')
        .eq('pdf_subdirectory', 'ajkd-core-curriculum')
        .order('slug');
    
    if (error) {
        console.error('❌ Error fetching documents:', error);
        return;
    }
    
    console.log(`📚 Found ${documents.length} AJKD documents\n`);
    
    const updates = [];
    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    
    for (const doc of documents) {
        // Try to extract year from filename first, then title
        let extractedYear = extractYearFromFilename(doc.pdf_filename);
        
        if (!extractedYear) {
            extractedYear = extractYearFromTitle(doc.title);
        }
        
        // Validate year is reasonable (between 2000 and 2030)
        if (extractedYear) {
            const yearNum = parseInt(extractedYear, 10);
            if (yearNum < 2000 || yearNum > 2030) {
                console.log(`⚠️  Skipping unlikely year ${extractedYear} for ${doc.slug}`);
                extractedYear = null;
            }
        }
        
        // Check if update is needed
        if (extractedYear && extractedYear !== doc.year) {
            updates.push({
                id: doc.id,
                slug: doc.slug,
                currentYear: doc.year,
                newYear: extractedYear,
                source: extractYearFromFilename(doc.pdf_filename) ? 'filename' : 'title'
            });
        } else if (!extractedYear && !doc.year) {
            unchangedCount++;
            console.log(`⏭️  No year found for ${doc.slug}`);
        } else if (doc.year === extractedYear) {
            unchangedCount++;
            console.log(`✓ ${doc.slug}: ${doc.year} (unchanged)`);
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Documents to update: ${updates.length}`);
    console.log(`   - Unchanged: ${unchangedCount}`);
    
    if (updates.length === 0) {
        console.log('\n✅ No updates needed!');
        return;
    }
    
    console.log(`\n📝 Updates to be made:`);
    for (const update of updates) {
        console.log(`   - ${update.slug}: ${update.currentYear || 'NULL'} → ${update.newYear} (from ${update.source})`);
    }
    
    // Confirm before updating
    console.log(`\n🔄 Updating database...`);
    
    for (const update of updates) {
        const { error: updateError } = await supabase
            .from('documents')
            .update({ year: update.newYear })
            .eq('id', update.id);
        
        if (updateError) {
            console.error(`❌ Error updating ${update.slug}:`, updateError.message);
            errorCount++;
        } else {
            console.log(`✓ Updated ${update.slug}: ${update.currentYear || 'NULL'} → ${update.newYear}`);
            updatedCount++;
        }
    }
    
    console.log(`\n✅ Complete!`);
    console.log(`   - Updated: ${updatedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Unchanged: ${unchangedCount}`);
}

// Run the script
updateAJKDYears()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });



