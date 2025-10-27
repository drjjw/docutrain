// Simple test to check if the drug conversion rule is in the server.js file
const fs = require('fs');
const serverCode = fs.readFileSync('server.js', 'utf8');

// Check if the drug conversion rule is present
const hasRule = serverCode.includes('ukidney.com/drugs');
console.log('Drug conversion rule check:', hasRule ? '✓ FOUND' : '✗ NOT FOUND');

// Find all occurrences of the rule
const matches = serverCode.match(/ukidney\.com\/drugs/g);
console.log('Number of occurrences:', matches ? matches.length : 0);

// Show the context around the rule
const lines = serverCode.split('\n');
lines.forEach((line, index) => {
  if (line.includes('ukidney.com/drugs')) {
    console.log(`\nLine ${index + 1}: ${line.trim()}`);
  }
});