#!/usr/bin/env node

/**
 * Merge all Bloomberg-Sen Fund PDFs into a single PDF
 * Sorted chronologically by year and quarter
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const BASE_DIR = path.join(__dirname, '../PDFs/bs/BloombergSen Fund');
const OUTPUT_FILE = path.join(__dirname, '../PDFs/bs/BloombergSen-Fund-Complete.pdf');

/**
 * Recursively find all PDF files in a directory
 */
function findPDFs(dir) {
  const files = [];
  
  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

/**
 * Extract year and quarter from filename for sorting
 * Expected format: "BSPF Q1 2013.pdf" or similar
 */
function extractYearQuarter(filepath) {
  const filename = path.basename(filepath);
  
  // Match patterns like "Q1 2013", "Q2 2014", etc.
  const match = filename.match(/Q(\d)\s+(\d{4})/i);
  
  if (match) {
    const quarter = parseInt(match[1]);
    const year = parseInt(match[2]);
    return { year, quarter, filepath };
  }
  
  // Fallback: try to extract just the year from the path
  const yearMatch = filepath.match(/\/(\d{4})\//);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    return { year, quarter: 0, filepath };
  }
  
  return { year: 0, quarter: 0, filepath };
}

/**
 * Sort PDFs chronologically
 */
function sortPDFs(pdfPaths) {
  const parsed = pdfPaths.map(extractYearQuarter);
  
  parsed.sort((a, b) => {
    if (a.year !== b.year) {
      return a.year - b.year;
    }
    return a.quarter - b.quarter;
  });
  
  return parsed.map(p => p.filepath);
}

/**
 * Merge all PDFs into a single document
 */
async function mergePDFs(pdfPaths) {
  console.log(`\nMerging ${pdfPaths.length} PDF files...\n`);
  
  const mergedPdf = await PDFDocument.create();
  let totalPages = 0;
  
  for (let i = 0; i < pdfPaths.length; i++) {
    const pdfPath = pdfPaths[i];
    const filename = path.basename(pdfPath);
    
    try {
      console.log(`[${i + 1}/${pdfPaths.length}] Adding: ${filename}`);
      
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
      
      totalPages += pdf.getPageCount();
      console.log(`    ✓ Added ${pdf.getPageCount()} pages (Total: ${totalPages})`);
      
    } catch (error) {
      console.error(`    ✗ Error processing ${filename}:`, error.message);
    }
  }
  
  return mergedPdf;
}

/**
 * Main execution
 */
async function main() {
  console.log('Bloomberg-Sen Fund PDF Merger');
  console.log('================================\n');
  
  // Check if base directory exists
  if (!fs.existsSync(BASE_DIR)) {
    console.error(`Error: Directory not found: ${BASE_DIR}`);
    process.exit(1);
  }
  
  // Find all PDFs
  console.log('Scanning for PDF files...');
  const pdfPaths = findPDFs(BASE_DIR);
  console.log(`Found ${pdfPaths.length} PDF files\n`);
  
  if (pdfPaths.length === 0) {
    console.log('No PDF files found. Exiting.');
    process.exit(0);
  }
  
  // Sort chronologically
  console.log('Sorting files chronologically...');
  const sortedPaths = sortPDFs(pdfPaths);
  
  // Display sorted order
  console.log('\nMerge order:');
  sortedPaths.forEach((filepath, index) => {
    const filename = path.basename(filepath);
    const year = filepath.match(/\/(\d{4})\//)?.[1] || '????';
    console.log(`  ${String(index + 1).padStart(2, ' ')}. [${year}] ${filename}`);
  });
  
  // Merge PDFs
  const mergedPdf = await mergePDFs(sortedPaths);
  
  // Save the merged PDF
  console.log('\nSaving merged PDF...');
  const pdfBytes = await mergedPdf.save();
  fs.writeFileSync(OUTPUT_FILE, pdfBytes);
  
  const fileSizeMB = (pdfBytes.length / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ Successfully created: ${OUTPUT_FILE}`);
  console.log(`  Total pages: ${mergedPdf.getPageCount()}`);
  console.log(`  File size: ${fileSizeMB} MB`);
  console.log('\nDone!');
}

// Run the script
main().catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});

