/**
 * Generate detailed report of conversations that would be banned
 * Run with: node scripts/generate-ban-report.js
 */

const { createClient } = require('@supabase/supabase-js');
const { checkContent } = require('../lib/utils/profanity-filter');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mlxctdgnojvkgfqldaob.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateReport() {
    console.log('📊 Generating ban report...\n');
    console.log('='.repeat(80));

    // Fetch all conversations
    const { data: conversations, error } = await supabase
        .from('chat_conversations')
        .select('id, question, banned, ban_reason, created_at, document_name, document_ids')
        .not('question', 'is', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching conversations:', error);
        process.exit(1);
    }

    console.log(`📊 Total conversations analyzed: ${conversations.length}\n`);

    const report = {
        generated_at: new Date().toISOString(),
        total_conversations: conversations.length,
        summary: {
            already_banned: 0,
            would_be_banned: 0,
            would_be_banned_profanity: 0,
            would_be_banned_junk: 0,
        },
        already_banned: [],
        would_be_banned: [],
    };

    // Analyze each conversation
    for (const conv of conversations) {
        const question = conv.question || '';
        const check = checkContent(question);

        if (conv.banned === true) {
            report.summary.already_banned++;
            report.already_banned.push({
                id: conv.id,
                question: question,
                ban_reason: conv.ban_reason || 'unknown',
                created_at: conv.created_at,
                document_name: conv.document_name,
            });
        } else if (check.shouldBan) {
            report.summary.would_be_banned++;
            if (check.reason === 'profanity') {
                report.summary.would_be_banned_profanity++;
            } else {
                report.summary.would_be_banned_junk++;
            }

            report.would_be_banned.push({
                id: conv.id,
                question: question,
                reason: check.reason,
                created_at: conv.created_at,
                document_name: conv.document_name,
            });
        }
    }

    // Generate text report
    const reportText = generateTextReport(report);
    console.log(reportText);

    // Save JSON report
    const reportDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const jsonPath = path.join(reportDir, `ban-report-${timestamp}.json`);
    const txtPath = path.join(reportDir, `ban-report-${timestamp}.txt`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(txtPath, reportText);

    console.log(`\n✅ Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   TXT:  ${txtPath}`);

    return report;
}

function generateTextReport(report) {
    let text = '';
    text += '='.repeat(80) + '\n';
    text += 'BAN REPORT - Conversations Analysis\n';
    text += `Generated: ${report.generated_at}\n`;
    text += '='.repeat(80) + '\n\n';

    // Summary
    text += '📊 SUMMARY\n';
    text += '-'.repeat(80) + '\n';
    text += `Total conversations analyzed: ${report.total_conversations}\n`;
    text += `Already banned: ${report.summary.already_banned}\n`;
    text += `Would be banned: ${report.summary.would_be_banned}\n`;
    text += `  - Profanity: ${report.summary.would_be_banned_profanity}\n`;
    text += `  - Junk: ${report.summary.would_be_banned_junk}\n`;
    text += '\n';

    // Already banned
    if (report.already_banned.length > 0) {
        text += '🚫 ALREADY BANNED\n';
        text += '-'.repeat(80) + '\n';
        report.already_banned.forEach((item, i) => {
            text += `${i + 1}. [${item.id.substring(0, 8)}...] ${item.created_at}\n`;
            text += `   Reason: ${item.ban_reason}\n`;
            text += `   Document: ${item.document_name || 'N/A'}\n`;
            text += `   Question: "${item.question.substring(0, 100)}${item.question.length > 100 ? '...' : ''}"\n`;
            text += '\n';
        });
        text += '\n';
    }

    // Would be banned - Profanity
    const profanityItems = report.would_be_banned.filter(item => item.reason === 'profanity');
    if (profanityItems.length > 0) {
        text += '🚫 WOULD BE BANNED - PROFANITY\n';
        text += '-'.repeat(80) + '\n';
        profanityItems.forEach((item, i) => {
            text += `${i + 1}. [${item.id.substring(0, 8)}...] ${item.created_at}\n`;
            text += `   Document: ${item.document_name || 'N/A'}\n`;
            text += `   Question: "${item.question}"\n`;
            text += '\n';
        });
        text += '\n';
    }

    // Would be banned - Junk
    const junkItems = report.would_be_banned.filter(item => item.reason === 'junk');
    if (junkItems.length > 0) {
        text += '🗑️  WOULD BE BANNED - JUNK\n';
        text += '-'.repeat(80) + '\n';
        junkItems.forEach((item, i) => {
            text += `${i + 1}. [${item.id.substring(0, 8)}...] ${item.created_at}\n`;
            text += `   Document: ${item.document_name || 'N/A'}\n`;
            text += `   Question: "${item.question}"\n`;
            text += '\n';
        });
        text += '\n';
    }

    // Statistics by document
    const byDocument = {};
    report.would_be_banned.forEach(item => {
        const doc = item.document_name || 'Unknown';
        if (!byDocument[doc]) {
            byDocument[doc] = { profanity: 0, junk: 0 };
        }
        if (item.reason === 'profanity') {
            byDocument[doc].profanity++;
        } else {
            byDocument[doc].junk++;
        }
    });

    if (Object.keys(byDocument).length > 0) {
        text += '📋 BREAKDOWN BY DOCUMENT\n';
        text += '-'.repeat(80) + '\n';
        Object.entries(byDocument)
            .sort((a, b) => (b[1].profanity + b[1].junk) - (a[1].profanity + a[1].junk))
            .forEach(([doc, counts]) => {
                const total = counts.profanity + counts.junk;
                text += `${doc}: ${total} total (${counts.profanity} profanity, ${counts.junk} junk)\n`;
            });
        text += '\n';
    }

    text += '='.repeat(80) + '\n';
    text += 'END OF REPORT\n';
    text += '='.repeat(80) + '\n';

    return text;
}

// Main execution
generateReport()
    .then(() => {
        console.log('\n✅ Report generation complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });







