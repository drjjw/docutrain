/**
 * Unban false positives - conversations that are currently banned but shouldn't be
 * Run with: node scripts/unban-false-positives.js --apply
 */

const { createClient } = require('@supabase/supabase-js');
const { checkContent } = require('../lib/utils/profanity-filter');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mlxctdgnojvkgfqldaob.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function unbanFalsePositives(dryRun = true) {
    console.log('🔍 Finding false positives to unban...\n');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no updates)' : 'LIVE (will update database)'}\n`);

    // Get all banned conversations
    const { data: banned, error } = await supabase
        .from('chat_conversations')
        .select('id, question, ban_reason')
        .eq('banned', true);

    if (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }

    const falsePositives = [];
    for (const conv of banned) {
        const check = checkContent(conv.question || '');
        if (!check.shouldBan) {
            falsePositives.push(conv);
        }
    }

    console.log(`📊 Found ${falsePositives.length} false positives out of ${banned.length} banned conversations\n`);

    if (falsePositives.length > 0) {
        console.log('Examples:');
        falsePositives.slice(0, 10).forEach((fp, i) => {
            console.log(`  ${i + 1}. [${fp.id.substring(0, 8)}...] "${fp.question.substring(0, 60)}..."`);
            console.log(`     Current reason: ${fp.ban_reason}`);
        });
        console.log('');

        if (!dryRun) {
            console.log('💾 Unbanning false positives...\n');
            let updated = 0;
            for (const fp of falsePositives) {
                const { error: updateError } = await supabase
                    .from('chat_conversations')
                    .update({ banned: false, ban_reason: null })
                    .eq('id', fp.id);

                if (updateError) {
                    console.error(`❌ Error updating ${fp.id}:`, updateError);
                } else {
                    updated++;
                }
            }
            console.log(`✅ Unbanned ${updated} false positives`);
        } else {
            console.log('💡 DRY RUN - No updates made');
            console.log(`   To apply, run: node scripts/unban-false-positives.js --apply`);
        }
    } else {
        console.log('✅ No false positives found!');
    }
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

async function main() {
    if (!dryRun) {
        console.log('⚠️  WARNING: This will update the database!');
        console.log('   Press Ctrl+C to cancel, or wait 3 seconds...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    try {
        await unbanFalsePositives(dryRun);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();

