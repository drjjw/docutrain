/**
 * Check OpenAI API Rate Limits
 * 
 * This script checks your current OpenAI API rate limits by:
 * 1. Making a test API call
 * 2. Reading the response headers
 * 3. Displaying your current limits
 */

const OpenAI = require('openai');
require('dotenv').config();

async function checkRateLimits() {
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY not found in environment');
        process.exit(1);
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    console.log('🔍 Checking OpenAI API rate limits...\n');

    try {
        // Make a test embedding call (lightweight)
        const testText = 'test';
        const startTime = Date.now();
        
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: testText
        });
        
        const responseTime = Date.now() - startTime;
        
        // Extract rate limit headers from response
        const headers = response.headers || {};
        
        console.log('📊 Rate Limit Information:');
        console.log('═══════════════════════════════════════');
        
        // Check if we have headers (OpenAI SDK may not expose all headers)
        const rateLimitInfo = {
            'x-ratelimit-limit-requests': headers['x-ratelimit-limit-requests'] || 'Not provided',
            'x-ratelimit-limit-tokens': headers['x-ratelimit-limit-tokens'] || 'Not provided',
            'x-ratelimit-remaining-requests': headers['x-ratelimit-remaining-requests'] || 'Not provided',
            'x-ratelimit-remaining-tokens': headers['x-ratelimit-remaining-tokens'] || 'Not provided',
            'x-ratelimit-reset-requests': headers['x-ratelimit-reset-requests'] || 'Not provided',
            'x-ratelimit-reset-tokens': headers['x-ratelimit-reset-tokens'] || 'Not provided'
        };
        
        for (const [key, value] of Object.entries(rateLimitInfo)) {
            console.log(`   ${key}: ${value}`);
        }
        
        console.log('\n📈 Test API Call:');
        console.log('═══════════════════════════════════════');
        console.log(`   Response time: ${responseTime}ms`);
        console.log(`   Embedding dimensions: ${response.data[0].embedding.length}`);
        console.log(`   Model used: text-embedding-3-small`);
        
        console.log('\n💡 Interpretation:');
        console.log('═══════════════════════════════════════');
        
        // Try to infer tier from response headers
        const limitRequests = parseInt(rateLimitInfo['x-ratelimit-limit-requests']);
        
        if (limitRequests && !isNaN(limitRequests)) {
            if (limitRequests <= 10) {
                console.log('   ⚠️  Very low limit detected - likely Tier 1 (3 req/min default)');
                console.log('   💰 Consider upgrading to Tier 2 for better throughput');
            } else if (limitRequests <= 600) {
                console.log('   ✅ Tier 2 detected (500 req/min) - Good for moderate scale');
            } else if (limitRequests >= 3000) {
                console.log('   🚀 Tier 3 detected (3500+ req/min) - Excellent for high scale');
            } else {
                console.log(`   📊 Custom tier detected: ${limitRequests} requests/min`);
            }
        } else {
            console.log('   ⚠️  Rate limit headers not available in response');
            console.log('   📝 Check OpenAI Dashboard: https://platform.openai.com/account/limits');
        }
        
        console.log('\n🔗 Next Steps:');
        console.log('═══════════════════════════════════════');
        console.log('1. Check OpenAI Dashboard: https://platform.openai.com/account/limits');
        console.log('2. View usage: https://platform.openai.com/usage');
        console.log('3. Request limit increase: https://platform.openai.com/account/limits');
        console.log('4. Monitor real-time: Watch headers during actual processing');
        
    } catch (error) {
        console.error('❌ Error checking rate limits:', error.message);
        
        if (error.status === 429) {
            console.log('\n⚠️  Rate limit exceeded!');
            console.log('   Wait a few minutes and try again');
        } else if (error.status === 401) {
            console.log('\n⚠️  Authentication failed');
            console.log('   Check your OPENAI_API_KEY is correct');
        }
        
        process.exit(1);
    }
}

// Run the check
checkRateLimits();

