# Supabase Performance & Security Lints Analysis

**Generated:** 2025-01-XX  
**Total Issues:** 104  
**Project:** mlxctdgnojvkgfqldaob

## Executive Summary

The Supabase database linter identified **104 performance warnings** across three main categories:
1. **RLS Auth Function Re-evaluation** (44 issues) - Most critical for query performance
2. **Multiple Permissive Policies** (57 issues) - Significant performance overhead
3. **Duplicate Indexes** (3 issues) - Wasted storage and maintenance overhead

---

## Theme 1: RLS Auth Function Re-evaluation ⚠️

**Issue Count:** 44  
**Severity:** HIGH - Affects query performance at scale  
**Impact:** `auth.<function>()` calls are re-evaluated for every row instead of once per query

### Problem
RLS policies are calling `auth.uid()`, `auth.role()`, or `current_setting()` directly, causing PostgreSQL to re-evaluate these functions for each row being checked. This creates unnecessary overhead, especially on large tables.

### Solution
Wrap auth function calls in a subquery: `auth.<function>()` → `(select auth.<function>())`

### Affected Tables & Policies

#### Documents Table (8 policies)
- `Owner admins can delete documents`
- `Owner admins can insert documents`
- `Owner admins can update documents`
- `Owner-admin-only documents require owner admin role`
- `Owner-restricted documents require owner membership`
- `Super admins and owner admins can view all documents`
- `Users can insert their own documents`
- `Users can update their own documents`

#### User Profiles Table (5 policies)
- `Service role can manage profiles`
- `Users can insert own profile`
- `Users can read own profile`
- `Users can update own profile`

#### User Owner Access Table (5 policies)
- `Admins grant access`
- `Admins revoke access`
- `Owner admins read group access`
- `Super admins read all access`
- `Users read own access`

#### Quiz-Related Tables (8 policies)
- `quizzes`: `Authenticated users can read quizzes`, `Service role can manage quizzes`
- `quiz_questions`: `Authenticated users can read quiz questions`, `Service role can manage quiz questions`
- `quiz_attempts`: `Service role can manage attempts`, `Users can create own attempts`, `Users can read own attempts`

#### Document Processing Tables (4 policies)
- `document_processing_logs`: `Admins can view all quiz generation logs`, `Users can view quiz generation logs for accessible documents`, `Users can view their own document processing logs`
- `document_training_history`: `Admins can view all training history`, `Users can view training history for accessible documents`

#### User Management Tables (5 policies)
- `user_invitations`: `Owner admins can view their invitations`, `Service role can manage invitations`, `Super admins can view all invitations`
- `user_roles`: `Users read own roles`
- `categories`: `Allow authenticated delete own categories`, `Allow authenticated update own categories`

#### Document Attachments (5 policies)
- `document_attachments`: All CRUD policies (`document_attachments_delete_policy`, `document_attachments_insert_policy`, `document_attachments_select_policy`, `document_attachments_update_policy`)
- `document_attachment_downloads`: `attachment_downloads_select_policy`

#### User Documents Table (3 policies)
- `Users can delete own documents`
- `Users can insert own documents`
- `Users can read own documents`
- `Users can update own documents`

### Remediation Priority
1. **High Priority:** `documents`, `user_profiles`, `user_owner_access` (most frequently queried)
2. **Medium Priority:** Quiz-related tables, document processing logs
3. **Low Priority:** Attachment tables, categories

---

## Theme 2: Multiple Permissive Policies 🔄

**Issue Count:** 57  
**Severity:** MEDIUM-HIGH - Each policy executes for every query  
**Impact:** Multiple policies for the same role/action must all execute, increasing query time

### Problem
Tables have multiple permissive (non-restrictive) RLS policies for the same role and action. PostgreSQL must evaluate ALL policies, even if one would suffice. This is inefficient.

### Solution
Consolidate multiple permissive policies into a single policy using `OR` conditions, or use restrictive policies where appropriate.

### Affected Tables

#### Documents Table (3 role/action combinations)
- **INSERT** (`authenticated`): 2 policies
  - `Owner admins can insert documents`
  - `Users can insert their own documents`
- **SELECT** (`authenticated`): 5 policies ⚠️
  - `Owner-admin-only documents require owner admin role`
  - `Owner-restricted documents require owner membership`
  - `Public and passcode documents readable by all`
  - `Registered documents readable by authenticated users`
  - `Super admins and owner admins can view all documents`
- **UPDATE** (`authenticated`): 2 policies
  - `Owner admins can update documents`
  - `Users can update their own documents`

#### Document Processing Logs (4 role combinations, SELECT only)
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 3 policies each
  - `Admins can view all quiz generation logs`
  - `Users can view quiz generation logs for accessible documents`
  - `Users can view their own document processing logs`

#### Document Training History (4 role combinations, SELECT only)
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 2 policies each
  - `Admins can view all training history`
  - `Users can view training history for accessible documents`

#### Owners Table (6 role/action combinations)
- **SELECT** (`anon`): 4 policies
- **INSERT** (`authenticated`): 2 policies
- **SELECT** (`authenticated`, `authenticator`, `dashboard_user`): 3 policies each
- **UPDATE** (`authenticated`): 2 policies

#### Quiz Attempts (6 role combinations)
- **INSERT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 2 policies each
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 2 policies each

#### Quiz Questions (4 role combinations, SELECT only)
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 2 policies each

#### Quizzes (4 role combinations, SELECT only)
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 2 policies each

#### User Invitations (4 role combinations, SELECT only)
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 3 policies each

#### User Owner Access (4 role combinations, SELECT only)
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 3 policies each

#### User Profiles (12 role/action combinations)
- **INSERT/SELECT/UPDATE** × (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 2 policies each

#### User Roles (4 role combinations, SELECT only)
- **SELECT** (`anon`, `authenticated`, `authenticator`, `dashboard_user`): 4 policies each

### Remediation Strategy
1. **Consolidate by combining conditions:** Merge policies using `OR` logic
2. **Use restrictive policies:** Convert some permissive policies to restrictive where appropriate
3. **Priority order:**
   - `documents` SELECT (5 policies!) - Highest impact
   - `user_profiles` (12 combinations) - Very high impact
   - `document_processing_logs` - High query volume
   - Quiz-related tables - Medium-high impact

---

## Theme 3: Duplicate Indexes 📊

**Issue Count:** 3  
**Severity:** LOW-MEDIUM - Wasted storage and maintenance  
**Impact:** Duplicate indexes consume storage and slow down writes

### Problem
The `documents` table has duplicate indexes - multiple indexes on the same columns with identical definitions.

### Affected Indexes

#### Documents Table
1. **Active column:**
   - `documents_active_idx` (duplicate)
   - `idx_documents_active` (keep one)

2. **Owner ID column:**
   - `documents_owner_id_idx` (duplicate)
   - `idx_documents_owner_id` (keep one)

3. **Slug column:**
   - `documents_slug_idx` (duplicate)
   - `idx_documents_slug` (keep one)

### Solution
Drop the duplicate indexes. Recommendation: Keep the `idx_*` prefixed ones for consistency, drop the `*_idx` suffixed ones.

### Remediation
```sql
DROP INDEX IF EXISTS documents_active_idx;
DROP INDEX IF EXISTS documents_owner_id_idx;
DROP INDEX IF EXISTS documents_slug_idx;
```

---

## Impact Assessment

### Performance Impact by Theme

1. **RLS Auth Re-evaluation (44 issues)**
   - **Query Performance:** High impact on SELECT queries
   - **Scale Impact:** Gets worse as tables grow
   - **Fix Complexity:** Low (syntax change)
   - **Estimated Improvement:** 10-30% faster queries on large tables

2. **Multiple Permissive Policies (57 issues)**
   - **Query Performance:** Medium-high impact
   - **Scale Impact:** Linear with number of policies
   - **Fix Complexity:** Medium (requires policy consolidation)
   - **Estimated Improvement:** 5-20% faster queries

3. **Duplicate Indexes (3 issues)**
   - **Write Performance:** Low-medium impact
   - **Storage:** Wasted space
   - **Fix Complexity:** Very low (DROP statements)
   - **Estimated Improvement:** Minimal query impact, reduces storage

### Overall Priority

1. **Immediate:** Fix RLS auth re-evaluation on high-traffic tables (`documents`, `user_profiles`)
2. **Short-term:** Consolidate multiple permissive policies, especially `documents` SELECT
3. **Quick win:** Drop duplicate indexes

---

## Next Steps

1. ✅ Review this analysis
2. 🔧 Create migration to fix RLS auth re-evaluation
3. 🔧 Consolidate multiple permissive policies
4. 🔧 Drop duplicate indexes
5. 📊 Monitor query performance improvements
6. 🔄 Re-run Supabase linter to verify fixes

---

## References

- [Supabase RLS Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)









