# RLS Policy Restoration Script

This script restores all RLS (Row Level Security) policies from backup files to your Supabase database.

## Files

- **`scripts/generate-policy-restore.js`** - Node.js script that generates the SQL restoration file
- **`migrations/restore_all_policies.sql`** - Generated SQL script containing all policy DROP and CREATE statements

## Usage

### Step 1: Generate the Restoration SQL (if needed)

If you need to regenerate the SQL file from the backup policies:

```bash
node scripts/generate-policy-restore.js
```

This will create/update `migrations/restore_all_policies.sql` with all policies from `backups/supabase_backup_latest/schema/policies/`.

### Step 2: Apply via Supabase MCP

The restoration script can be applied directly using Supabase MCP:

```bash
# The SQL file is ready to apply via Supabase MCP
# Use: mcp_supabase_apply_migration
```

Or apply it manually via Supabase Dashboard:
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the contents of `migrations/restore_all_policies.sql`
4. Execute the script

## What This Script Does

1. **Drops all existing policies** - Removes current RLS policies to avoid conflicts
2. **Creates all policies from backup** - Restores all 73 policies from backup files
3. **Includes verification queries** - Provides SQL to verify the restoration was successful

## Policy Summary

The restoration script includes policies for **19 tables**:

- `categories` (5 policies)
- `chat_conversations` (4 policies)
- `document_attachment_downloads` (2 policies)
- `document_attachments` (4 policies)
- `document_chunks` (1 policy)
- `document_chunks_local` (3 policies)
- `document_processing_logs` (4 policies)
- `document_training_history` (3 policies)
- `documents` (11 policies)
- `owners` (7 policies)
- `quiz_attempts` (3 policies)
- `quiz_questions` (2 policies)
- `quizzes` (2 policies)
- `system_config` (2 policies)
- `user_documents` (4 policies)
- `user_invitations` (3 policies)
- `user_owner_access` (5 policies)
- `user_profiles` (4 policies)
- `user_roles` (4 policies)

**Total: 73 policies**

## Important Notes

⚠️ **WARNING**: This script will DROP all existing policies before recreating them. Make sure you:
- Have a backup of your current database state
- Understand what policies are being restored
- Test in a development environment first if possible

## Verification

After applying the script, run these queries to verify:

```sql
-- Count total policies (should be 73)
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
```

## Troubleshooting

If policies fail to create:
1. Check that all referenced tables exist
2. Verify that all referenced functions exist (e.g., `check_is_super_admin`)
3. Ensure you have the necessary permissions
4. Check Supabase logs for specific error messages

## Source Files

The policies are restored from individual SQL files in:
```
backups/supabase_backup_latest/schema/policies/
```

Each file contains a single `CREATE POLICY` statement.

