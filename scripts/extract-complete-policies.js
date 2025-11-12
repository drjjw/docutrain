#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const COMPLETE_DUMP = path.join(WORKSPACE_ROOT, 'backups/supabase_backup_latest/complete_dump/complete_schema_and_data.sql');
const OUTPUT_FILE = path.join(WORKSPACE_ROOT, 'migrations/restore_all_policies_complete.sql');

console.log('🔍 Extracting complete policies from dump...\n');

// Extract policies using awk
const awkCommand = `awk 'NR>=3199 && /^CREATE POLICY/ {start=NR; policy=""} NR>=3199 && start {policy=policy (policy?"\\n":"") $0} NR>=3199 && start && /;$/ {print policy; start=0; policy=""}' "${COMPLETE_DUMP}"`;
const extractedPolicies = execSync(awkCommand, { encoding: 'utf8' });

// Split by CREATE POLICY to get individual policies
const policyBlocks = extractedPolicies.split(/^CREATE POLICY/m).filter(b => b.trim());

const policies = [];
for (const block of policyBlocks) {
  // Add back CREATE POLICY with proper spacing
  const policySQL = 'CREATE POLICY ' + block.trim();
  
  // Extract policy name and table using regex that handles multi-line
  const nameMatch = policySQL.match(/CREATE POLICY\s+"([^"]+)"/);
  // Table name can be on same line or next line, handle both
  const tableMatch = policySQL.match(/ON\s+"public"\s*\.\s*"([^"]+)"/) || 
                     policySQL.match(/ON\s+"public"\s*\.\s*([^\s"]+)/);
  
  if (nameMatch && tableMatch) {
    policies.push({
      name: nameMatch[1],
      table: tableMatch[1],
      sql: policySQL
    });
  } else {
    // Debug: log what we couldn't parse
    console.warn('Could not parse policy:', policySQL.substring(0, 150));
  }
}

console.log(`✅ Found ${policies.length} complete policies\n`);

if (policies.length === 0) {
  console.error('❌ No policies found!');
  process.exit(1);
}

// Generate DROP statements
const dropStatements = policies.map(p => 
  `DROP POLICY IF EXISTS "${p.name}" ON "public"."${p.table}";`
);

// Generate CREATE statements
const createStatements = policies.map(p => 
  `-- Policy: ${p.name}\n${p.sql}`
);

// Generate the complete SQL script
const sqlScript = `-- ============================================================================
-- Complete RLS Policy Restoration Script (from complete dump)
-- Generated: ${new Date().toISOString()}
-- Source: backups/supabase_backup_latest/complete_dump/complete_schema_and_data.sql
-- Total Policies: ${policies.length}
-- ============================================================================
--
-- WARNING: This script will DROP all existing policies and recreate them
-- from the complete dump. Use with caution!
--
-- ============================================================================
-- STEP 1: Drop all existing policies
-- ============================================================================

${dropStatements.join('\n')}

-- ============================================================================
-- STEP 2: Create all policies from complete dump
-- ============================================================================

${createStatements.join('\n\n')}

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

console.log(`✅ Generated complete restoration script: ${OUTPUT_FILE}`);
console.log(`\n📊 Summary:`);
console.log(`   - Total policies: ${policies.length}`);
console.log(`   - Tables affected: ${new Set(policies.map(p => p.table)).size}`);

// Group by table for summary
const byTable = {};
for (const policy of policies) {
  if (!byTable[policy.table]) {
    byTable[policy.table] = [];
  }
  byTable[policy.table].push(policy.name);
}

console.log(`\n📋 Policies by table:`);
for (const [table, policyNames] of Object.entries(byTable).sort()) {
  console.log(`   - ${table}: ${policyNames.length} policies`);
}

console.log(`\n✨ Done! You can now apply this script via Supabase MCP.`);
