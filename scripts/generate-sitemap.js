#!/usr/bin/env node
/**
 * Sitemap Generation Script
 * 
 * Generates a sitemap.xml file containing all publicly accessible documents
 * that are marked as active and opted into sitemap inclusion.
 * 
 * Usage: node scripts/generate-sitemap.js [--output path/to/sitemap.xml] [--base-url https://www.docutrain.io]
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mlxctdgnojvkgfqldaob.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
let outputPath = path.join(__dirname, '..', 'dist', 'public', 'sitemap.xml');
let baseUrl = process.env.SITE_URL || process.env.PUBLIC_BASE_URL || 'https://www.docutrain.io';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) {
    outputPath = args[i + 1];
    i++;
  } else if (args[i] === '--base-url' && args[i + 1]) {
    baseUrl = args[i + 1];
    i++;
  }
}

// Ensure baseUrl doesn't end with a slash
baseUrl = baseUrl.replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Generate sitemap.xml content
 */
function generateSitemap(documents, staticPages = []) {
  // Generate URLs for static pages (higher priority)
  const staticUrls = staticPages.map(page => {
    const lastmodDate = page.lastmod ? new Date(page.lastmod).toISOString().split('T')[0] : null;
    return `    <url>
      <loc>${escapeXml(page.url)}</loc>${lastmodDate ? `
      <lastmod>${lastmodDate}</lastmod>` : ''}
      <changefreq>${page.changefreq || 'monthly'}</changefreq>
      <priority>${page.priority || '1.0'}</priority>
    </url>`;
  }).join('\n');

  // Generate URLs for documents
  const documentUrls = documents.map(doc => {
    // Generate URL for document - using /app/chat?doc=slug format
    const url = `${baseUrl}/app/chat?doc=${encodeURIComponent(doc.slug)}`;
    
    // Use updated_at as lastmod, or created_at if updated_at is null
    const lastmod = doc.updated_at || doc.created_at;
    const lastmodDate = lastmod ? new Date(lastmod).toISOString().split('T')[0] : null;
    
    return `    <url>
      <loc>${escapeXml(url)}</loc>${lastmodDate ? `
      <lastmod>${lastmodDate}</lastmod>` : ''}
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`;
  }).join('\n');

  // Combine static pages and documents
  const allUrls = staticUrls + (staticUrls && documentUrls ? '\n' : '') + documentUrls;

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls}
</urlset>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Main function
 */
async function main() {
  console.log('🗺️  Generating sitemap...');
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Output: ${outputPath}`);

  try {
    // Query all public documents that are active and opted into sitemap
    const { data: documents, error } = await supabase
      .from('documents')
      .select('slug, updated_at, created_at')
      .eq('access_level', 'public')
      .eq('active', true)
      .eq('include_in_sitemap', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error querying documents:', error);
      process.exit(1);
    }

    // Define static pages to include in sitemap (always include these)
    const staticPages = [
      {
        url: `${baseUrl}/`,
        changefreq: 'weekly',
        priority: '1.0',
        lastmod: null // Homepage changes frequently, no specific lastmod
      },
      {
        url: `${baseUrl}/app/contact`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: null
      },
      {
        url: `${baseUrl}/app/terms`,
        changefreq: 'yearly',
        priority: '0.5',
        lastmod: null
      }
    ];

    if (!documents || documents.length === 0) {
      console.log('⚠️  No public documents found for sitemap');
      console.log(`   Including ${staticPages.length} static page(s)`);
      
      // Still create sitemap with static pages
      const sitemapContent = generateSitemap([], staticPages);
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, sitemapContent, 'utf8');
      console.log(`✓ Sitemap generated successfully!`);
      console.log(`   ${staticPages.length} static page(s) included`);
      console.log(`   Saved to: ${outputPath}`);
      return;
    }

    console.log(`   Found ${documents.length} public document(s) to include`);
    console.log(`   Including ${staticPages.length} static page(s)`);

    // Generate sitemap XML
    const sitemapContent = generateSitemap(documents, staticPages);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write sitemap to file
    fs.writeFileSync(outputPath, sitemapContent, 'utf8');
    
    console.log(`✓ Sitemap generated successfully!`);
    console.log(`   ${staticPages.length} static page(s) included`);
    console.log(`   ${documents.length} document URL(s) included`);
    console.log(`   Total: ${staticPages.length + documents.length} URL(s)`);
    console.log(`   Saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

// Run the script
main();
