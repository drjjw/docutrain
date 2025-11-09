/**
 * Backfill script to detect junk/profanity in existing conversations
 * Shows results before updating database
 * Run with: node scripts/backfill-ban-detection.js [--dry-run]
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

async function analyzeConversations(dryRun = true) {
    console.log('🔍 Analyzing existing conversations for junk/profanity...\n');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no updates)' : 'LIVE (will update database)'}\n`);
    console.log('='.repeat(80));

    // Fetch all conversations (or recent ones)
    const { data: conversations, error } = await supabase
        .from('chat_conversations')
        .select('id, question, banned, ban_reason, created_at')
        .not('question', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10000); // Adjust limit as needed

    if (error) {
        console.error('❌ Error fetching conversations:', error);
        process.exit(1);
    }

    console.log(`📊 Total conversations analyzed: ${conversations.length}\n`);

    const stats = {
        total: conversations.length,
        alreadyBanned: 0,
        alreadyBannedProfanity: 0,
        alreadyBannedJunk: 0,
        alreadyBannedOther: 0,
        currentlyNotBanned: 0,
        shouldBeBanned: 0,
        shouldBeBannedProfanity: 0,
        shouldBeBannedJunk: 0,
        falsePositives: 0, // Already banned but shouldn't be
        needsUpdate: 0,
    };

    const examples = {
        newProfanity: [],
        newJunk: [],
        falsePositives: [],
        alreadyCorrect: [],
    };

    console.log('Analyzing conversations...\n');

    for (const conv of conversations) {
        const question = conv.question || '';
        
        // Skip if already banned
        if (conv.banned === true) {
            stats.alreadyBanned++;
            if (conv.ban_reason === 'profanity') {
                stats.alreadyBannedProfanity++;
            } else if (conv.ban_reason === 'junk') {
                stats.alreadyBannedJunk++;
            } else {
                stats.alreadyBannedOther++;
            }
            
            // Verify if it should still be banned
            const check = checkContent(question);
            if (!check.shouldBan) {
                stats.falsePositives++;
                if (examples.falsePositives.length < 5) {
                    examples.falsePositives.push({
                        id: conv.id,
                        question: question.substring(0, 100),
                        currentReason: conv.ban_reason,
                    });
                }
            } else {
                if (examples.alreadyCorrect.length < 5) {
                    examples.alreadyCorrect.push({
                        id: conv.id,
                        question: question.substring(0, 100),
                        reason: conv.ban_reason,
                    });
                }
            }
            continue;
        }

        // Check if currently not banned but should be
        stats.currentlyNotBanned++;
        const check = checkContent(question);
        
        if (check.shouldBan) {
            stats.shouldBeBanned++;
            stats.needsUpdate++;
            
            if (check.reason === 'profanity') {
                stats.shouldBeBannedProfanity++;
                if (examples.newProfanity.length < 10) {
                    examples.newProfanity.push({
                        id: conv.id,
                        question: question.substring(0, 100),
                        reason: check.reason,
                        created_at: conv.created_at,
                    });
                }
            } else if (check.reason === 'junk') {
                stats.shouldBeBannedJunk++;
                if (examples.newJunk.length < 10) {
                    examples.newJunk.push({
                        id: conv.id,
                        question: question.substring(0, 100),
                        reason: check.reason,
                        created_at: conv.created_at,
                    });
                }
            }
        }
    }

    // Print statistics
    console.log('📈 STATISTICS\n');
    console.log(`Total conversations: ${stats.total}`);
    console.log(`Already banned: ${stats.alreadyBanned}`);
    console.log(`  - Profanity: ${stats.alreadyBannedProfanity}`);
    console.log(`  - Junk: ${stats.alreadyBannedJunk}`);
    console.log(`  - Other/Unknown: ${stats.alreadyBannedOther}`);
    console.log(`Currently not banned: ${stats.currentlyNotBanned}`);
    console.log(`\n🚨 SHOULD BE BANNED: ${stats.shouldBeBanned}`);
    console.log(`  - Profanity: ${stats.shouldBeBannedProfanity}`);
    console.log(`  - Junk: ${stats.shouldBeBannedJunk}`);
    console.log(`\n⚠️  False positives (banned but shouldn't be): ${stats.falsePositives}`);
    console.log(`\n📝 Conversations needing update: ${stats.needsUpdate}`);

    // Print examples
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 EXAMPLES\n');

    if (examples.newProfanity.length > 0) {
        console.log('🚫 NEW PROFANITY DETECTED (would be banned):');
        examples.newProfanity.forEach((ex, i) => {
            console.log(`  ${i + 1}. [${ex.id.substring(0, 8)}...] "${ex.question}"`);
            console.log(`     Reason: ${ex.reason}, Created: ${ex.created_at}`);
        });
        console.log('');
    }

    if (examples.newJunk.length > 0) {
        console.log('🗑️  NEW JUNK DETECTED (would be banned):');
        examples.newJunk.forEach((ex, i) => {
            console.log(`  ${i + 1}. [${ex.id.substring(0, 8)}...] "${ex.question}"`);
            console.log(`     Reason: ${ex.reason}, Created: ${ex.created_at}`);
        });
        console.log('');
    }

    if (examples.falsePositives.length > 0) {
        console.log('⚠️  FALSE POSITIVES (currently banned but should not be):');
        examples.falsePositives.forEach((ex, i) => {
            console.log(`  ${i + 1}. [${ex.id.substring(0, 8)}...] "${ex.question}"`);
            console.log(`     Current reason: ${ex.currentReason}`);
        });
        console.log('');
    }

    if (examples.alreadyCorrect.length > 0) {
        console.log('✅ CORRECTLY BANNED (examples):');
        examples.alreadyCorrect.forEach((ex, i) => {
            console.log(`  ${i + 1}. [${ex.id.substring(0, 8)}...] "${ex.question}"`);
            console.log(`     Reason: ${ex.reason}`);
        });
        console.log('');
    }

    // Update database if not dry run
    if (!dryRun && stats.needsUpdate > 0) {
        console.log('='.repeat(80));
        console.log('\n💾 UPDATING DATABASE...\n');
        
        let updated = 0;
        let errors = 0;

        for (const conv of conversations) {
            if (conv.banned === true) continue; // Skip already banned
            
            const question = conv.question || '';
            const check = checkContent(question);
            
            if (check.shouldBan) {
                const { error: updateError } = await supabase
                    .from('chat_conversations')
                    .update({
                        banned: true,
                        ban_reason: check.reason
                    })
                    .eq('id', conv.id);

                if (updateError) {
                    console.error(`❌ Error updating ${conv.id}:`, updateError);
                    errors++;
                } else {
                    updated++;
                    if (updated % 100 === 0) {
                        console.log(`  Updated ${updated} conversations...`);
                    }
                }
            }
        }

        console.log(`\n✅ Update complete!`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Errors: ${errors}`);
    } else if (dryRun && stats.needsUpdate > 0) {
        console.log('='.repeat(80));
        console.log('\n💡 DRY RUN MODE - No database updates made');
        console.log(`   To apply updates, run: node scripts/backfill-ban-detection.js --apply`);
    }

    return stats;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

async function main() {
    if (!dryRun) {
        console.log('⚠️  WARNING: This will update the database!');
        console.log('   Press Ctrl+C to cancel, or wait 3 seconds...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    try {
        const stats = await analyzeConversations(dryRun);
        console.log('\n✅ Analysis complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();

