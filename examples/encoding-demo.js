#!/usr/bin/env node

/**
 * URL Encoding Demo Script
 * Run with: node encoding-demo.js
 */

console.log('🔧 URL Encoding Demo for Back Button Parameter\n');
console.log('='.repeat(60));

// Example 1: Simple URL (no encoding needed, but recommended)
console.log('\n📝 Example 1: Simple URL');
const simple = 'https://ukidney.com';
const simpleEncoded = encodeURIComponent(simple);
const simpleURL = `?doc=smh&back-button=${simpleEncoded}`;
console.log('Original:', simple);
console.log('Encoded:', simpleEncoded);
console.log('Full URL:', simpleURL);

// Example 2: URL with path (no encoding needed, but recommended)
console.log('\n📝 Example 2: URL with Path');
const withPath = 'https://ukidney.com/manuals/smh';
const withPathEncoded = encodeURIComponent(withPath);
const withPathURL = `?doc=smh&back-button=${withPathEncoded}`;
console.log('Original:', withPath);
console.log('Encoded:', withPathEncoded);
console.log('Full URL:', withPathURL);

// Example 3: URL with query parameters (MUST encode!)
console.log('\n📝 Example 3: URL with Query Parameters (MUST ENCODE!)');
const withQuery = 'https://ukidney.com/page?id=123&ref=test';
const withQueryEncoded = encodeURIComponent(withQuery);
const withQueryURL = `?doc=smh&back-button=${withQueryEncoded}`;
console.log('Original:', withQuery);
console.log('Encoded:', withQueryEncoded);
console.log('Full URL:', withQueryURL);
console.log('⚠️  Without encoding, this would break!');

// Example 4: URL with hash (MUST encode!)
console.log('\n📝 Example 4: URL with Hash Fragment (MUST ENCODE!)');
const withHash = 'https://ukidney.com/page#section';
const withHashEncoded = encodeURIComponent(withHash);
const withHashURL = `?doc=smh&back-button=${withHashEncoded}`;
console.log('Original:', withHash);
console.log('Encoded:', withHashEncoded);
console.log('Full URL:', withHashURL);

// Example 5: Using URLSearchParams (automatic encoding)
console.log('\n📝 Example 5: Using URLSearchParams (Automatic Encoding)');
const complexURL = 'https://ukidney.com/search?q=kidney disease&sort=date';
const params = new URLSearchParams();
params.set('doc', 'smh');
params.set('back-button', complexURL);
params.set('method', 'rag');
const autoEncodedURL = `?${params.toString()}`;
console.log('Original:', complexURL);
console.log('Full URL:', autoEncodedURL);
console.log('✅ URLSearchParams automatically encoded the values!');

// Example 6: Helper function
console.log('\n📝 Example 6: Reusable Helper Function');
function buildChatURL(docSlug, backURL, options = {}) {
    const params = new URLSearchParams();
    params.set('doc', docSlug);
    
    if (backURL) {
        params.set('back-button', backURL);
    }
    
    if (options.method) {
        params.set('method', options.method);
    }
    
    return `?${params.toString()}`;
}

console.log('Helper function created! Usage:');
console.log('buildChatURL("smh", "https://ukidney.com")');
console.log('→', buildChatURL('smh', 'https://ukidney.com'));
console.log('\nbuildChatURL("uhn", "https://ukidney.com/page?id=123", { method: "rag" })');
console.log('→', buildChatURL('uhn', 'https://ukidney.com/page?id=123', { method: 'rag' }));
console.log('\nbuildChatURL("smh", null)  // No back button');
console.log('→', buildChatURL('smh', null));

// Example 7: Common mistake demonstration
console.log('\n❌ Example 7: Common Mistake - Not Encoding');
const brokenURL = '?doc=smh&back-button=https://ukidney.com/page?id=123&ref=test';
console.log('Broken URL:', brokenURL);
console.log('Problem: The ? and & in the back URL will be parsed as separate parameters!');
console.log('This would be parsed as:');
console.log('  - doc=smh');
console.log('  - back-button=https://ukidney.com/page?id=123');
console.log('  - ref=test (separate parameter!)');
console.log('\n✅ Fixed version:');
const fixedURL = `?doc=smh&back-button=${encodeURIComponent('https://ukidney.com/page?id=123&ref=test')}`;
console.log('Fixed URL:', fixedURL);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📚 Summary:');
console.log('='.repeat(60));
console.log('✅ Always use encodeURIComponent() when building URLs in code');
console.log('✅ Or use URLSearchParams for automatic encoding');
console.log('⚠️  URLs with ?, &, #, or spaces MUST be encoded');
console.log('💡 Simple URLs work without encoding but encoding is recommended');
console.log('\n🚀 Try the interactive demo: open encoding-examples.html');
console.log('📖 Read the docs: docs/URL-ENCODING-CHEATSHEET.md');
console.log('');

