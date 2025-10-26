#!/usr/bin/env node

/**
 * Bloomberg Sen Document Training Script
 *
 * This script adds Bloomberg Sen documents to the database registry
 * and trains them with embeddings. Skips build.js update since we're in RAG-only mode.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Validate document configuration
 */
function validateDocumentConfig(doc, index) {
    const required = ['slug', 'title', 'pdfFilename', 'pdfSubdirectory', 'embeddingTypes'];
    const missing = required.filter(field => !doc[field]);

    if (missing.length > 0) {
        throw new Error(`Document ${index + 1} is missing required fields: ${missing.join(', ')}`);
    }

    // Validate embedding types
    const validTypes = ['openai', 'local', 'both'];
    if (!validTypes.includes(doc.embeddingTypes)) {
        throw new Error(`Document ${index + 1} has invalid embeddingTypes: ${doc.embeddingTypes}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Check if PDF exists
    const pdfPath = path.join(__dirname, '..', 'PDFs', doc.pdfSubdirectory, doc.pdfFilename);
    if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
    }

    return true;
}

/**
 * Add document to database registry
 */
async function addDocumentToRegistry(doc) {
    const embeddingTypes = doc.embeddingTypes === 'both'
        ? ['openai', 'local']
        : [doc.embeddingTypes];

    // Determine primary embedding type (prefer OpenAI if both are specified)
    const primaryEmbeddingType = embeddingTypes.includes('openai') ? 'openai' : 'local';

    // Prepare metadata with owner info
    const metadata = doc.metadata || {};

    const record = {
        slug: doc.slug,
        title: doc.title,
        subtitle: doc.subtitle || null,
        back_link: doc.backLink || null,
        welcome_message: doc.welcomeMessage || doc.title,
        pdf_filename: doc.pdfFilename,
        pdf_subdirectory: doc.pdfSubdirectory,
        embedding_type: primaryEmbeddingType,
        year: doc.year || null,
        active: true,
        metadata: metadata,
        owner_id: '0db195fe-42b0-4a5d-be2e-20fa4316b94a' // Bloomberg Sen owner ID
    };

    // Check if document already exists
    const { data: existing } = await supabase
        .from('documents')
        .select('slug')
        .eq('slug', doc.slug)
        .single();

    if (existing) {
        console.log(`  ⊘ Document ${doc.slug} already exists in registry, skipping...`);
        return embeddingTypes.map(type => ({
            slug: doc.slug,
            status: 'exists',
            embeddingType: type
        }));
    }

    // Insert document
    const { data, error } = await supabase
        .from('documents')
        .insert([record])
        .select();

    if (error) {
        throw new Error(`Failed to insert ${doc.slug}: ${error.message}`);
    }

    console.log(`  ✓ Added ${doc.slug} to registry (primary: ${primaryEmbeddingType}, owner: bs)`);

    // Return results for all embedding types that will be trained
    return embeddingTypes.map(type => ({
        slug: doc.slug,
        status: 'added',
        embeddingType: type
    }));
}

/**
 * Check if a document already has embeddings of the specified type
 */
async function hasEmbeddings(slug, embeddingType) {
    const table = embeddingType === 'local' ? 'document_chunks_local' : 'document_chunks';

    try {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('document_slug', slug);

        if (error) {
            console.warn(`  ⚠️  Could not check existing embeddings for ${slug}: ${error.message}`);
            return false;
        }

        return count > 0;
    } catch (error) {
        console.warn(`  ⚠️  Error checking embeddings for ${slug}: ${error.message}`);
        return false;
    }
}

/**
 * Train document with embeddings
 */
async function trainDocument(slug, embeddingType, skipOpenai, skipLocal, skipExisting) {
    const isLocal = embeddingType === 'local';

    if (isLocal && skipLocal) {
        console.log(`  ⊘ Skipping local embeddings for ${slug} (--skip-local flag)`);
        return { slug, embeddingType, status: 'skipped' };
    }

    if (!isLocal && skipOpenai) {
        console.log(`  ⊘ Skipping OpenAI embeddings for ${slug} (--skip-openai flag)`);
        return { slug, embeddingType, status: 'skipped' };
    }

    // Check if embeddings already exist and skip if requested
    if (skipExisting) {
        const exists = await hasEmbeddings(slug, embeddingType);
        if (exists) {
            console.log(`  ⊘ Skipping ${slug} (${embeddingType}) - embeddings already exist (--skip-existing flag)`);
            return { slug, embeddingType, status: 'skipped', reason: 'already_exists' };
        }
    }

    const scriptName = isLocal ? 'chunk-and-embed-local.js' : 'chunk-and-embed.js';
    const scriptPath = path.join(__dirname, scriptName);

    console.log(`\n  🔄 Training ${slug} with ${embeddingType} embeddings...`);

    try {
        const startTime = Date.now();
        execSync(`node "${scriptPath}" --doc=${slug}`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`  ✓ Completed ${slug} (${embeddingType}) in ${duration}s`);
        return { slug, embeddingType, status: 'success', duration };
    } catch (error) {
        console.error(`  ✗ Failed to train ${slug} (${embeddingType}):`, error.message);
        return { slug, embeddingType, status: 'failed', error: error.message };
    }
}

/**
 * Generate summary report
 */
function generateSummary(results, totalTime) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 BLOOMBERG SEN TRAINING SUMMARY');
    console.log('='.repeat(70));

    const added = results.registry.filter(r => r.status === 'added');
    const exists = results.registry.filter(r => r.status === 'exists');
    const trained = results.training.filter(r => r.status === 'success');
    const failed = results.training.filter(r => r.status === 'failed');
    const skipped = results.training.filter(r => r.status === 'skipped');

    console.log('\n📝 Registry Updates:');
    console.log(`   ✓ Added: ${added.length} documents`);
    if (exists.length > 0) {
        console.log(`   ⊘ Already existed: ${exists.length} documents`);
    }

    console.log('\n🔢 Embedding Training:');
    console.log(`   ✓ Successfully trained: ${trained.length} documents`);
    if (failed.length > 0) {
        console.log(`   ✗ Failed: ${failed.length} documents`);
        failed.forEach(f => {
            console.log(`      - ${f.slug} (${f.embeddingType}): ${f.error}`);
        });
    }
    if (skipped.length > 0) {
        console.log(`   ⊘ Skipped: ${skipped.length} documents`);
    }

    console.log('\n⏱️  Performance:');
    console.log(`   Total time: ${totalTime}s`);
    if (trained.length > 0) {
        const avgTime = trained.reduce((sum, t) => sum + parseFloat(t.duration), 0) / trained.length;
        console.log(`   Average per document: ${avgTime.toFixed(1)}s`);
    }

    console.log('\n' + '='.repeat(70));

    if (failed.length === 0) {
        console.log('✅ All Bloomberg Sen documents processed successfully!');
    } else {
        console.log('⚠️  Some documents failed to process. See details above.');
    }
    console.log('='.repeat(70) + '\n');
}

/**
 * Main execution
 */
async function main() {
    console.log('\n🚀 Bloomberg Sen Document Training Script');
    console.log('='.repeat(70) + '\n');

    // Parse arguments
    const args = process.argv.slice(2);
    const skipOpenai = args.includes('--skip-openai');
    const skipLocal = args.includes('--skip-local');
    const skipExisting = args.includes('--skip-existing');
    const dryRun = args.includes('--dry-run');

    // Load configuration
    const configPath = path.join(__dirname, '..', 'training-data', 'documents-to-train-bloombergsen.json');

    if (!fs.existsSync(configPath)) {
        console.error(`❌ Config file not found: ${configPath}`);
        process.exit(1);
    }

    console.log(`📄 Loading Bloomberg Sen configuration...`);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.documents || !Array.isArray(config.documents)) {
        console.error('❌ Invalid config: must have "documents" array');
        process.exit(1);
    }

    console.log(`✓ Found ${config.documents.length} Bloomberg Sen documents to process\n`);

    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Validate all documents first
    console.log('🔍 Validating documents...');
    for (let i = 0; i < config.documents.length; i++) {
        try {
            validateDocumentConfig(config.documents[i], i);
            console.log(`  ✓ Document ${i + 1}: ${config.documents[i].slug}`);
        } catch (error) {
            console.error(`  ✗ ${error.message}`);
            process.exit(1);
        }
    }

    if (dryRun) {
        console.log('\n✓ Validation complete. Exiting (dry run mode).\n');
        process.exit(0);
    }

    const startTime = Date.now();
    const results = {
        registry: [],
        training: []
    };

    // Process each document
    for (let i = 0; i < config.documents.length; i++) {
        const doc = config.documents[i];
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📄 Processing Document ${i + 1}/${config.documents.length}: ${doc.slug}`);
        console.log('='.repeat(70));

        // Step 1: Add to registry
        console.log('\n1️⃣  Adding to database registry...');
        const registryResults = await addDocumentToRegistry(doc);
        results.registry.push(...registryResults);

        // Step 2: Train embeddings
        console.log('\n2️⃣  Training embeddings...');
        for (const result of registryResults) {
            if (result.status === 'added' || result.status === 'exists') {
                const trainingResult = await trainDocument(
                    result.slug,
                    result.embeddingType,
                    skipOpenai,
                    skipLocal,
                    skipExisting
                );
                results.training.push(trainingResult);
            }
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    generateSummary(results, totalTime);
}

// Run
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { validateDocumentConfig, addDocumentToRegistry };
