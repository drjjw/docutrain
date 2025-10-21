// Simple test script to verify embedding cache is working
const fetch = require('node-fetch');

async function testCache() {
    const API_BASE = 'http://localhost:3456';

    console.log('Testing embedding cache...\n');

    // First request
    console.log('1. Making first request...');
    const start1 = Date.now();
    const response1 = await fetch(`${API_BASE}/api/chat-rag?doc=smh&embedding=openai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: "What is chronic kidney disease?",
            sessionId: "cache-test-123",
            model: "grok"
        })
    });
    const time1 = Date.now() - start1;
    const data1 = await response1.json();
    console.log(`   Response time: ${time1}ms`);
    console.log(`   Status: ${response1.status}`);
    console.log(`   Response keys: ${Object.keys(data1).join(', ')}`);
    if (data1.error) console.log(`   Error: ${data1.error}`);
    if (data1.response) console.log(`   Response length: ${data1.response.length} chars`);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Second request with same query
    console.log('\n2. Making second request (same query)...');
    const start2 = Date.now();
    const response2 = await fetch(`${API_BASE}/api/chat-rag?doc=smh&embedding=openai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: "What is chronic kidney disease?",
            sessionId: "cache-test-123",
            model: "grok"
        })
    });
    const time2 = Date.now() - start2;
    const data2 = await response2.json();
    console.log(`   Response time: ${time2}ms`);
    console.log(`   Status: ${response2.status}`);
    console.log(`   Response keys: ${Object.keys(data2).join(', ')}`);
    if (data2.error) console.log(`   Error: ${data2.error}`);
    if (data2.response) console.log(`   Response length: ${data2.response.length} chars`);

    // Check cache stats
    console.log('\n3. Checking cache stats...');
    const cacheResponse = await fetch(`${API_BASE}/api/cache/stats`);
    const cacheData = await cacheResponse.json();
    console.log('Cache stats:', JSON.stringify(cacheData.cache, null, 2));

    console.log('\nTest completed!');
}

testCache().catch(console.error);
