#!/usr/bin/env node

/**
 * Generate Policy Restoration Script
 * 
 * Reads all policy files from the backup directory and creates a complete
 * SQL restoration script that can be applied via Supabase MCP.
 */

const fs = require('fs');
const path = require('path');

// Get workspace root (assuming script is in scripts/ directory)
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const POLICIES_DIR = path.join(WORKSPACE_ROOT, 'backups/supabase_backup_latest/schema/policies');
const OUTPUT_FILE = path.join(WORKSPACE_ROOT, 'migrations/restore_all_policies.sql');

// Policy name extraction regex - handles table names after "public".
// Matches: CREATE POLICY "name" ON "public"."table_name" [FOR/USING/etc]
// Table name can be quoted or unquoted, but in practice it's usually unquoted
const POLICY_NAME_REGEX = /CREATE POLICY\s+"([^"]+)"\s+ON\s+"public"\."?([^"\s]+)"?/i;
const POLICY_NAME_FROM_FILENAME_REGEX = /^public_(.+)\.sql$/;

console.log('🔍 Scanning policy files...\n');

// Read all policy files
const policyFiles = fs.readdirSync(POLICIES_DIR)
  .filter(file => file.endsWith('.sql'))
  .sort();

console.log(`Found ${policyFiles.length} policy files\n`);

const policies = [];
const dropStatements = [];
const createStatements = [];

// Process each policy file
for (const file of policyFiles) {
  const filePath = path.join(POLICIES_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8').trim();
  
  if (!content) {
    console.warn(`⚠️  Skipping empty file: ${file}`);
    continue;
  }

  // Extract policy name and table from CREATE POLICY statement
  const match = content.match(POLICY_NAME_REGEX);
  if (!match) {
    console.warn(`⚠️  Could not parse policy from: ${file}`);
    console.warn(`   Content preview: ${content.substring(0, 150)}...\n`);
    continue;
  }

  const [, policyName, tableName] = match;
  
  // Extract policy name from filename as fallback
  const filenameMatch = file.match(POLICY_NAME_FROM_FILENAME_REGEX);
  const filenamePolicyName = filenameMatch ? filenameMatch[1] : null;

  policies.push({
    file,
    policyName,
    tableName,
    content,
    filenamePolicyName
  });

  // Generate DROP statement (table name should not have extra quotes)
  const cleanTableName = tableName.replace(/"/g, '');
  dropStatements.push(`DROP POLICY IF EXISTS "${policyName}" ON "public"."${cleanTableName}";`);

  // Add CREATE statement
  createStatements.push(`-- Policy: ${policyName} (from ${file})`);
  createStatements.push(content);
  createStatements.push('');
}

console.log(`✅ Processed ${policies.length} policies\n`);

// Generate the complete SQL script
const sqlScript = `-- ============================================================================
-- Complete RLS Policy Restoration Script
-- Generated: ${new Date().toISOString()}
-- Source: backups/supabase_backup_latest/schema/policies/
-- Total Policies: ${policies.length}
-- ============================================================================
--
-- WARNING: This script will DROP all existing policies and recreate them
-- from backup files. Use with caution!
--
-- ============================================================================
-- STEP 1: Drop all existing policies
-- ============================================================================

${dropStatements.join('\n')}

-- ============================================================================
-- STEP 2: Create all policies from backup
-- ============================================================================

${createStatements.join('\n')}

-- ============================================================================
-- STEP 3: Verification Queries
-- ============================================================================

-- Count total policies
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';

-- List all policies by table
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- Restoration Complete
-- ============================================================================
-- Expected policy count: ${policies.length}
-- Verify the count matches above before considering restoration complete.
-- ============================================================================
`;

// Write the SQL script
fs.writeFileSync(OUTPUT_FILE, sqlScript, 'utf8');

console.log(`✅ Generated restoration script: ${OUTPUT_FILE}`);
console.log(`\n📊 Summary:`);
console.log(`   - Total policies: ${policies.length}`);
console.log(`   - Tables affected: ${new Set(policies.map(p => p.tableName)).size}`);

// Group by table for summary
const byTable = {};
for (const policy of policies) {
  if (!byTable[policy.tableName]) {
    byTable[policy.tableName] = [];
  }
  byTable[policy.tableName].push(policy.policyName);
}

console.log(`\n📋 Policies by table:`);
for (const [table, policyNames] of Object.entries(byTable).sort()) {
  console.log(`   - ${table}: ${policyNames.length} policies`);
}

console.log(`\n✨ Done! You can now apply this script via Supabase MCP.`);

