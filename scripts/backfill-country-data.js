/**
 * Backfill Country Data for Existing Conversations
 * 
 * This script:
 * 1. Finds all conversations with IP addresses but no country data
 * 2. Looks up country for each unique IP address
 * 3. Updates all conversations with that IP address
 * 
 * Usage: node scripts/backfill-country-data.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { getCountryFromIP } = require('../lib/utils/ip-geolocation');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function backfillCountryData() {
    console.log('🚀 Starting country data backfill...\n');

    try {
        // Step 1: Find all conversations with IP addresses but no country
        console.log('📊 Step 1: Finding conversations without country data...');
        const { data: conversations, error: fetchError } = await supabase
            .from('chat_conversations')
            .select('id, ip_address, country')
            .not('ip_address', 'is', null)
            .is('country', null)
            .limit(10000); // Process in batches if needed

        if (fetchError) {
            console.error('❌ Error fetching conversations:', fetchError);
            return;
        }

        if (!conversations || conversations.length === 0) {
            console.log('✅ No conversations need country data backfill!');
            return;
        }

        console.log(`📋 Found ${conversations.length} conversations without country data\n`);

        // Step 2: Get unique IP addresses
        const uniqueIPs = [...new Set(conversations.map(c => c.ip_address).filter(ip => ip))];
        console.log(`🌐 Found ${uniqueIPs.length} unique IP addresses to lookup\n`);

        // Step 3: Lookup country for each unique IP
        console.log('🔍 Step 2: Looking up countries for IP addresses...');
        const ipToCountry = new Map();
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < uniqueIPs.length; i++) {
            const ip = uniqueIPs[i];
            process.stdout.write(`\r   Processing ${i + 1}/${uniqueIPs.length}: ${ip}...`);

            // Skip localhost IPs
            if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
                continue;
            }

            try {
                const country = await getCountryFromIP(ip);
                if (country) {
                    ipToCountry.set(ip, country);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`\n   ⚠️  Error looking up ${ip}:`, error.message);
                failCount++;
            }

            // Rate limiting: ip-api.com allows 45 requests/minute
            // Add a small delay to avoid hitting the limit
            if (i < uniqueIPs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500)); // ~40 requests/minute
            }
        }

        console.log(`\n\n✅ Lookup complete:`);
        console.log(`   ✓ Successfully looked up: ${successCount} IPs`);
        console.log(`   ✗ Failed or null: ${failCount} IPs`);
        console.log(`   📊 Total countries found: ${ipToCountry.size}\n`);

        // Step 4: Update conversations in batches
        console.log('💾 Step 3: Updating conversations with country data...');
        let updateCount = 0;
        const batchSize = 100;

        for (const [ip, country] of ipToCountry.entries()) {
            // Find all conversations with this IP that need updating
            const conversationsToUpdate = conversations.filter(
                c => c.ip_address === ip && !c.country
            );

            if (conversationsToUpdate.length === 0) continue;

            // Update in batches
            for (let i = 0; i < conversationsToUpdate.length; i += batchSize) {
                const batch = conversationsToUpdate.slice(i, i + batchSize);
                const ids = batch.map(c => c.id);

                const { error: updateError } = await supabase
                    .from('chat_conversations')
                    .update({ country })
                    .in('id', ids);

                if (updateError) {
                    console.error(`\n   ❌ Error updating batch for IP ${ip}:`, updateError.message);
                } else {
                    updateCount += batch.length;
                    process.stdout.write(`\r   Updated ${updateCount} conversations...`);
                }
            }
        }

        console.log(`\n\n✅ Backfill complete!`);
        console.log(`   📊 Updated ${updateCount} conversations with country data`);
        console.log(`   🌍 Countries added: ${ipToCountry.size}`);

        // Show summary by country
        const countryCounts = new Map();
        for (const [ip, country] of ipToCountry.entries()) {
            const count = conversations.filter(c => c.ip_address === ip).length;
            countryCounts.set(country, (countryCounts.get(country) || 0) + count);
        }

        console.log(`\n📈 Summary by country:`);
        const sortedCountries = Array.from(countryCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        for (const [country, count] of sortedCountries) {
            console.log(`   ${country}: ${count} conversations`);
        }

    } catch (error) {
        console.error('\n❌ Backfill failed:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the backfill
backfillCountryData()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });

