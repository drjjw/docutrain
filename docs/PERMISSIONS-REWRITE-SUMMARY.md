# Document Permissions System Rewrite - Implementation Summary

**Date:** January 27, 2025  
**Status:** ✅ Complete

## Overview

Successfully rewrote the document permission system to replace confusing boolean flags (`is_public`, `requires_auth`) with a clear, single `access_level` enum that supports 5 distinct permission levels.

## Changes Made

### 1. Database Schema

**New Enum Type:**
```sql
CREATE TYPE document_access_level AS ENUM (
    'public',
    'passcode',
    'registered',
    'owner_restricted',
    'owner_admin_only'
);
```

**Documents Table Changes:**
- ✅ Added `access_level` column (type: `document_access_level`, default: `'public'`)
- ✅ Added `passcode` column (type: `TEXT`, nullable) for future passcode feature
- ✅ Removed `is_public` column
- ✅ Removed `requires_auth` column

**Data Migration:**
- 129 documents migrated to `public` access level
- 4 documents migrated to `owner_restricted` access level
- Migration logic:
  - `is_public=true, requires_auth=false` → `public`
  - `is_public=true, requires_auth=true` → `registered`
  - `is_public=false` → `owner_restricted`

### 2. Permission Check Functions

**Rewrote `user_has_document_access()` function:**
- ✅ Handles all 5 access levels
- ✅ Super admins can access everything
- ✅ Owner-restricted checks user_owner_access and user_roles tables
- ✅ Owner-admin-only checks for owner_admin role specifically
- ✅ Passcode level currently treated as public (validation to be implemented)

**Updated `user_has_document_access_by_slug()` function:**
- ✅ Works with new permission check logic

### 3. RLS Policies

**New SELECT Policies:**
1. `Public and passcode documents readable by all` - No auth required
2. `Registered documents readable by authenticated users` - Any logged-in user
3. `Owner-restricted documents require owner membership` - Owner group members only
4. `Owner-admin-only documents require owner admin role` - Owner admins only

**New Modification Policies:**
1. `Owner admins can insert documents` - Only owner admins and super admins
2. `Owner admins can update documents` - Only owner admins and super admins
3. `Owner admins can delete documents` - Only owner admins and super admins
4. `Allow service role full access on documents` - Service role (unchanged)

**Important:** Regular registered users can NO LONGER edit documents through the dashboard. Only owner admins and super admins have edit access.

### 4. Frontend Changes

**TypeScript Types (`app-src/src/types/admin.ts`):**
- ✅ Added `DocumentAccessLevel` type
- ✅ Updated `Document` interface to use `access_level` and `passcode`
- ✅ Removed `is_public` and `requires_auth` properties

**Document Editor Modal (`app-src/src/components/Admin/DocumentEditorModal.tsx`):**
- ✅ Replaced toggle switches with radio button group
- ✅ 5 radio options with clear descriptions
- ✅ Conditional passcode input field (shown when passcode selected)
- ✅ Warning when owner-restricted selected without owner
- ✅ Dynamic owner name display in descriptions

**Documents Table (`app-src/src/components/Admin/DocumentsTable.tsx`):**
- ✅ Updated `renderVisibilityBadge()` to show 5 access levels with appropriate icons
- ✅ Updated visibility filter dropdown with 5 options
- ✅ Updated filter logic to use `access_level`
- ✅ Updated badge display in table rows

**Badge Colors:**
- 🔵 Public - Blue (globe icon)
- 🟣 Passcode - Purple (key icon)
- 🟢 Registered - Green (user icon)
- 🟡 Owner Restricted - Yellow (users icon)
- 🔴 Owner Admins Only - Red (shield icon)

### 5. Backend Changes

**No changes required!** 
- Server routes already use `user_has_document_access_by_slug()` RPC function
- Admin API `updateDocument()` function handles new fields automatically

## Permission Level Definitions

### 1. Public
- **Access:** Anyone with URL, no login required
- **Use Case:** Publicly available documents, marketing materials
- **Cannot be:** Owner-restricted (mutually exclusive)

### 2. Passcode
- **Access:** Anyone with URL + correct passcode parameter
- **Use Case:** Semi-private sharing, event-specific documents
- **Status:** Placeholder (validation not yet implemented)
- **Future:** Will require `?passcode=VALUE` in URL

### 3. Registered
- **Access:** Any logged-in user, regardless of owner group
- **Use Case:** Internal documents accessible to all staff
- **Cannot be:** Owner-restricted (mutually exclusive)

### 4. Owner Restricted
- **Access:** Only members of the document's owner group
- **Includes:** Regular members AND owner admins of that group
- **Use Case:** Department-specific documents
- **Requires:** Document must have an owner assigned

### 5. Owner Admins Only
- **Access:** Only owner admins of the document's owner group
- **Excludes:** Regular members (even if in the owner group)
- **Use Case:** Sensitive administrative documents
- **Requires:** Document must have an owner assigned

## Special Cases

**Super Admins:**
- Can access ALL documents regardless of access level
- Can edit ALL documents

**Documents without Owner:**
- Can only use: Public, Passcode, or Registered
- Cannot use: Owner Restricted or Owner Admins Only
- UI shows warning if user tries to select owner-based levels

**Inactive Documents:**
- Not accessible through RLS policies regardless of access level
- Only visible in admin dashboard

## Testing Checklist

✅ Public documents accessible without login  
✅ Registered documents require login but work for any user  
✅ Owner-restricted documents only accessible to owner group members  
✅ Owner-admin-only documents only accessible to owner admins  
✅ Super admins can access everything  
✅ Non-owner-admins cannot edit documents (enforced by RLS)  
✅ Existing documents migrated correctly  
✅ UI correctly reflects document access levels  
✅ Filters work correctly in documents table  
✅ No linter errors in frontend code  
✅ Migration applied successfully to database

## Files Modified

### Database
- `/migrations/rewrite_document_permissions.sql` (new)

### Frontend
- `/app-src/src/types/admin.ts`
- `/app-src/src/components/Admin/DocumentEditorModal.tsx`
- `/app-src/src/components/Admin/DocumentsTable.tsx`

### Backend
- No changes required (uses RPC functions)

## Potential Impacts to Check

When testing the new permission system, verify:

1. ✅ Document chunks tables still work (foreign key constraints intact)
2. ✅ Chat conversations can still log document access
3. ✅ Document selector in chat interface respects new permissions
4. ✅ Owner-based features (chunk limits, custom domains) still function
5. ✅ Server-side permission checks work correctly via RPC
6. ✅ Admin dashboard only shows documents user has admin access to

## Future Enhancements

**Passcode Validation (Not Yet Implemented):**
- Add server-side passcode validation in permission check function
- Accept `?passcode=VALUE` URL parameter
- Compare against `documents.passcode` column
- Return 403 if passcode incorrect or missing

**Potential Additions:**
- Time-based access (documents available only during certain dates)
- IP-based restrictions
- Download tracking for passcode-protected documents
- Audit log for access attempts

## Migration Rollback (If Needed)

If rollback is required, you would need to:
1. Add back `is_public` and `requires_auth` columns
2. Migrate data back from `access_level`
3. Restore old RLS policies
4. Revert frontend changes

**Note:** Rollback not recommended after data has been modified with new system.

## Bug Fix: Super Admin Access

**Issue Found:** After initial migration, super admins couldn't access the admin dashboard.

**Root Cause:** The `user_permissions_summary` view used INNER JOIN with the `owners` table, which excluded super_admins (who have `owner_id = NULL`).

**Fix Applied:**
```sql
-- Modified view to explicitly handle super_admins with NULL owner_id
CREATE OR REPLACE VIEW user_permissions_summary AS
-- Super admins (owner_id is NULL)
SELECT 
  ur.user_id,
  ur.role,
  ur.owner_id,
  NULL::text as owner_slug,
  NULL::text as owner_name
FROM user_roles ur
WHERE ur.role = 'super_admin' AND ur.owner_id IS NULL
UNION
-- Owner admins and registered users (have owner_id)
...
```

**Status:** ✅ Fixed - Super admins now properly recognized by frontend permission checks.

## Conclusion

The permission system rewrite successfully simplifies document access control while adding more granular permission levels. The new system is clearer, more maintainable, and provides better separation between different access levels.

