/**
 * Test script for PubMed popup functionality
 */

import { fetchPubMedArticle } from './public/js/pubmed-api.js';

async function testPubMedAPI() {
    console.log('🧪 Testing PubMed API functionality...\n');

    // Test with the PMID we added (40382193)
    const testPMID = '40382193';

    try {
        console.log(`📚 Testing PMID: ${testPMID}`);
        const article = await fetchPubMedArticle(testPMID);

        console.log('✅ Successfully fetched article data:');
        console.log(`   Title: ${article.title}`);
        console.log(`   Authors: ${article.authors}`);
        console.log(`   Journal: ${article.journal}`);
        console.log(`   Year: ${article.pubDate}`);
        console.log(`   DOI: ${article.doi || 'Not available'}`);
        console.log(`   Abstract: ${article.abstract ? 'Available' : 'Not available'}`);

        // Test caching - second call should be instant
        console.log('\n📦 Testing cache...');
        const startTime = Date.now();
        const cachedArticle = await fetchPubMedArticle(testPMID);
        const cacheTime = Date.now() - startTime;

        console.log(`✅ Cache hit in ${cacheTime}ms`);
        console.log(`   Same data: ${JSON.stringify(article) === JSON.stringify(cachedArticle)}`);

    } catch (error) {
        console.error('❌ Error testing PubMed API:', error.message);
    }

    console.log('\n🏁 Test completed');
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testPubMedAPI();
}

export { testPubMedAPI };
