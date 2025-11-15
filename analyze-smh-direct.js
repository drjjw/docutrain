/**
 * Direct database analysis for SMH document - Ancef dosing
 * Queries chunks directly from database and searches for relevant content
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function searchChunksForAncef() {
    console.log('🔍 SEARCHING SMH DOCUMENT FOR ANCEF/PERITONITIS');
    console.log('='.repeat(80));
    
    try {
        // Search for chunks containing "ancef" or "cefazolin" (generic name)
        const { data: ancefChunks, error: ancefError } = await supabase
            .from('document_chunks')
            .select('chunk_index, content, metadata')
            .eq('document_slug', 'smh')
            .or('content.ilike.%ancef%,content.ilike.%cefazolin%,content.ilike.%peritonitis%')
            .limit(20);
        
        if (ancefError) {
            console.error('Error searching chunks:', ancefError);
            return;
        }
        
        console.log(`\n📚 Found ${ancefChunks?.length || 0} potentially relevant chunks`);
        console.log('='.repeat(80));
        
        if (!ancefChunks || ancefChunks.length === 0) {
            console.log('❌ No chunks found containing "ancef", "cefazolin", or "peritonitis"');
            return;
        }
        
        // Search for dosing information
        const dosingKeywords = ['dose', 'dosing', 'mg', 'mg/kg', 'g', 'gram', 'iv', 'intravenous'];
        
        for (let i = 0; i < Math.min(ancefChunks.length, 10); i++) {
            const chunk = ancefChunks[i];
            const contentLower = chunk.content.toLowerCase();
            
            // Check if chunk contains dosing info
            const hasDosing = dosingKeywords.some(kw => contentLower.includes(kw));
            const hasAncef = contentLower.includes('ancef') || contentLower.includes('cefazolin');
            const hasPeritonitis = contentLower.includes('peritonitis');
            
            if (hasAncef && hasDosing) {
                console.log(`\n📄 Chunk ${chunk.chunk_index} (RELEVANT - Contains Ancef/Cefazolin + Dosing):`);
                console.log('-'.repeat(80));
                console.log(`Content (${chunk.content.length} chars):`);
                console.log(chunk.content.substring(0, 800));
                if (chunk.content.length > 800) {
                    console.log('...');
                }
                console.log('-'.repeat(80));
                
                // Extract dosing information
                const lines = chunk.content.split('\n');
                const dosingLines = lines.filter(line => {
                    const lineLower = line.toLowerCase();
                    return (lineLower.includes('ancef') || lineLower.includes('cefazolin')) &&
                           (lineLower.includes('mg') || lineLower.includes('dose') || lineLower.includes('g '));
                });
                
                if (dosingLines.length > 0) {
                    console.log('\n💊 Dosing Information Found:');
                    dosingLines.forEach(line => console.log(`   - ${line.trim()}`));
                }
            }
        }
        
        // Also search for peritonitis-specific chunks
        console.log('\n\n🔍 SEARCHING FOR PERITONITIS-SPECIFIC CHUNKS:');
        console.log('='.repeat(80));
        
        const { data: peritonitisChunks, error: peritonitisError } = await supabase
            .from('document_chunks')
            .select('chunk_index, content, metadata')
            .eq('document_slug', 'smh')
            .ilike('content', '%peritonitis%')
            .limit(10);
        
        if (!peritonitisError && peritonitisChunks && peritonitisChunks.length > 0) {
            console.log(`Found ${peritonitisChunks.length} chunks mentioning peritonitis`);
            
            for (const chunk of peritonitisChunks.slice(0, 5)) {
                const contentLower = chunk.content.toLowerCase();
                if (contentLower.includes('ancef') || contentLower.includes('cefazolin')) {
                    console.log(`\n📄 Chunk ${chunk.chunk_index} (Peritonitis + Ancef):`);
                    console.log('-'.repeat(80));
                    console.log(chunk.content.substring(0, 600));
                    console.log('-'.repeat(80));
                }
            }
        }
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

searchChunksForAncef().catch(console.error);



