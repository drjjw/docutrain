#!/usr/bin/env node

/**
 * Download a user document from Supabase Storage
 * Usage: node scripts/download-user-document.js <user_document_id> [output_path]
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const USER_DOCUMENT_ID = process.argv[2];
const OUTPUT_PATH = process.argv[3];

if (!USER_DOCUMENT_ID) {
  console.error('❌ Error: User document ID is required');
  console.log('Usage: node scripts/download-user-document.js <user_document_id> [output_path]');
  process.exit(1);
}

async function downloadUserDocument() {
  try {
    // Create Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔍 Looking up user document: ${USER_DOCUMENT_ID}`);

    // Get the user document to find the file_path
    const { data: userDoc, error: docError } = await supabase
      .from('user_documents')
      .select('file_path, title, user_id')
      .eq('id', USER_DOCUMENT_ID)
      .single();

    if (docError || !userDoc) {
      throw new Error(`Failed to find user document: ${docError?.message || 'Not found'}`);
    }

    console.log(`✅ Found document: ${userDoc.title || 'Untitled'}`);
    console.log(`📁 File path: ${userDoc.file_path}`);

    // Generate signed URL (valid for 1 hour)
    console.log('🔐 Generating signed download URL...');
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('user-documents')
      .createSignedUrl(userDoc.file_path, 3600);

    if (signedUrlError || !signedUrlData) {
      throw new Error(`Failed to generate signed URL: ${signedUrlError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Signed URL generated (valid for 1 hour)`);
    console.log(`📥 Downloading file...`);

    // Download the file
    const response = await fetch(signedUrlData.signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine output filename
    const filename = OUTPUT_PATH || path.basename(userDoc.file_path);
    const outputPath = path.resolve(filename);

    // Write file
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ File downloaded successfully!`);
    console.log(`📄 Saved to: ${outputPath}`);
    console.log(`📊 File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

downloadUserDocument();







