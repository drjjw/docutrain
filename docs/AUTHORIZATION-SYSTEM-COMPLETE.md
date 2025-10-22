# Multi-Level Authorization System - Implementation Complete

## Overview

Implemented a three-tier permission system that integrates authenticated users with owner groups, adds public/private document controls, and maintains full backward compatibility with existing URL-based document access.

## Authorization Tiers

### Tier 1: Registered Users
- Basic authenticated users
- Can access private documents from assigned owner groups
- Can upload documents
- Read-only access to group documents

### Tier 2: Owner Admins  
- All Tier 1 permissions
- Manage users within their owner group(s)
- Grant/revoke access to their groups
- Upload documents to their group

### Tier 3: Super Admins
- Full system access
- Access to all owner groups
- Manage all users and roles
- System-wide administration

## Database Schema

### New Tables

**user_roles:**
```sql
id          UUID PRIMARY KEY
user_id     UUID → auth.users(id)
role        TEXT ('registered' | 'owner_admin' | 'super_admin')
owner_id    UUID → owners(id)
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
UNIQUE(user_id, owner_id)
```

**user_owner_access:**
```sql
id          UUID PRIMARY KEY
user_id     UUID → auth.users(id)
owner_id    UUID → owners(id)
granted_at  TIMESTAMPTZ
granted_by  UUID → auth.users(id)
UNIQUE(user_id, owner_id)
```

### Updated Tables

**documents table - New columns:**
- `is_public` BOOLEAN (default: true) - Accessible without authentication
- `requires_auth` BOOLEAN (default: false) - Requires login even if public

**Backward Compatibility:**
- All existing documents set to `is_public = true`
- Maintains current URL-based access (`?doc=smh`)
- No breaking changes

## Permission Check Logic

### Document Access Flow

```
1. Is document public AND doesn't require auth?
   → ✅ Allow (anyone can access)

2. Does document require auth AND user not logged in?
   → ❌ Deny (show login prompt)

3. Is document public AND requires auth AND user logged in?
   → ✅ Allow (any authenticated user)

4. Is document private AND user not logged in?
   → ❌ Deny (show login prompt)

5. Is user super_admin?
   → ✅ Allow (full access)

6. Does user have owner access or is owner_admin for document's owner?
   → ✅ Allow
   → ❌ Deny (no permission)
```

## Database Functions

### user_has_document_access(user_id, document_id)
Main permission check function - Returns boolean indicating access

### user_has_document_access_by_slug(user_id, slug)
Convenience function to check access by document slug

### is_super_admin(user_id)
Check if user is super admin

### is_owner_admin(user_id, owner_id)
Check if user is admin for specific owner group

### get_user_owner_access(user_id)
Get all owner groups user has access to with their roles

## API Endpoints

### Permission Management (`/api/permissions`)

**GET /api/permissions**
- Returns user's permissions, roles, and owner groups
- Authenticated only

**GET /api/permissions/accessible-owners**
- List of owner groups user can access
- Authenticated only

**GET /api/permissions/accessible-documents**
- List of all documents user can access (public + private with permission)
- Authenticated only

**POST /api/permissions/check-access/:slug**
- Check if user can access specific document
- Works for both auth and unauth users

**POST /api/permissions/grant-owner-access**
- Grant user access to owner group
- Owner_admin or super_admin only

**DELETE /api/permissions/revoke-owner-access/:access_id**
- Revoke user's access to owner group
- Owner_admin or super_admin only

### Chat Endpoint Updates (`/api/chat`)

**Permission checking:**
- Automatically verifies access to each document in query
- Returns 403 with helpful message if access denied
- Message indicates if login required or permission missing
- Supports multi-document queries (checks all)

## RLS Policies

### documents table

**Public documents:**
```sql
"Public documents readable by all"
- is_public = true AND NOT requires_auth
```

**Public auth-required:**
```sql
"Public auth-required docs readable by authenticated"
- is_public = true AND requires_auth = true
- TO authenticated only
```

**Private documents:**
```sql
"Private documents require owner access"
- is_public = false
- user_has_document_access(auth.uid(), id)
- TO authenticated only
```

### user_roles table

- Users read their own roles
- Owner admins read roles in their group
- Super admins read all roles
- Only super admins can insert/update/delete roles

### user_owner_access table

- Users read their own access
- Owner admins read access in their group
- Super admins read all access
- Admins can grant/revoke access to their groups

## React Dashboard Integration

### New Components

**OwnerGroups.tsx:**
- Displays user's owner group memberships
- Shows role badges
- Highlights super admin status

**PermissionsBadge.tsx:**
- Visual role indicator
- Color-coded by role type
- Shows owner name context

### New Hooks

**usePermissions:**
```typescript
const { permissions, loading, isSuperAdmin, ownerGroups } = usePermissions();
```

Returns:
- `permissions` - Full permission object
- `loading` - Loading state
- `isSuperAdmin` - Boolean
- `ownerGroups` - Array of owner access with roles

### Dashboard Updates

Dashboard now shows:
1. Owner Groups card with access list
2. Role badges (User, Admin, Super Admin)
3. Super admin indicator if applicable
4. Upload section
5. User's uploaded documents

## Testing Scenarios

### Test 1: Public Document Access (Backward Compatibility) ✅

**Scenario:** Unauthenticated user accesses public document
```
Visit: http://localhost:3456/?doc=smh
Expected: Document loads normally (existing behavior)
Status: ✅ Working
```

### Test 2: Vanilla JS Chat Still Works ✅

**Scenario:** Chat with public document without login
```
Visit: http://localhost:3456/?doc=smh
Ask question in chat
Expected: RAG response as normal
Status: ✅ Working
```

### Test 3: New User Has No Permissions ✅

**Scenario:** New user signs up
```
1. Sign up at /app/signup
2. View dashboard
Expected: "No owner group access" message shown
Status: ✅ Dashboard shows no access message
```

### Test 4: Grant Owner Access (Manual)

**To test permissions, manually grant access:**
```sql
-- Get user ID from Supabase Auth dashboard
-- Get owner ID for ukidney
INSERT INTO user_owner_access (user_id, owner_id)
VALUES (
  '<user-uuid-here>',
  (SELECT id FROM owners WHERE slug = 'ukidney')
);
```

Then refresh dashboard - should see "UKidney Medical" access!

### Test 5: Make Document Private

**Mark a document as private:**
```sql
UPDATE documents 
SET is_public = false 
WHERE slug = 'smh';
```

**Test access:**
- Unauthenticated: Should get 403 error
- User without ukidney access: Should get 403
- User with ukidney access: Should work ✅

## Owner Groups in System

Current owners:
1. **ukidney** - UKidney Medical
2. **maker** - Maker Pizza
3. **cpdn** - CPD Network
4. **default** - Default Owner

## How to Grant Permissions

### Option 1: Direct SQL (Quickest)

**Grant owner access:**
```sql
INSERT INTO user_owner_access (user_id, owner_id)
SELECT 
  '<user-email-or-id>',
  id 
FROM owners 
WHERE slug = 'ukidney';
```

**Make owner admin:**
```sql
INSERT INTO user_roles (user_id, owner_id, role)
SELECT 
  '<user-email-or-id>',
  id,
  'owner_admin'
FROM owners 
WHERE slug = 'ukidney';
```

**Make super admin:**
```sql
-- Get any owner ID (super admins need at least one owner association)
INSERT INTO user_roles (user_id, owner_id, role)
SELECT 
  '<user-uuid>',
  id,
  'super_admin'
FROM owners 
WHERE slug = 'ukidney'
LIMIT 1;
```

### Option 2: Via API (When logged in as admin)

```javascript
POST /api/permissions/grant-owner-access
{
  "target_user_id": "<uuid>",
  "owner_id": "<uuid>"
}
```

## Things to Check After RLS Changes

✅ **Verified:**
- Existing public documents still accessible without auth
- URL access (`?doc=smh`) still works
- Chat API respects new permission system
- Vanilla JS app continues working
- User-uploaded documents (user_documents table) unaffected

⚠️ **Monitor:**
- Document selector should filter based on user access (future)
- Private document access via chat API (test after granting permissions)
- Error messages clear for users without access

## Next Steps

### Immediate (To Test Permissions)

1. **Create test user** at /app/signup
2. **Grant ukidney access** via SQL:
```sql
INSERT INTO user_owner_access (user_id, owner_id)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@example.com'),
  (SELECT id FROM owners WHERE slug = 'ukidney')
);
```
3. **Refresh dashboard** - should see ukidney access
4. **Mark document private** and test access control

### Future Enhancements

1. **Admin UI** - Web interface to manage permissions
2. **Registration flow** - Assign default owner on signup
3. **Invitation system** - Email invites to owner groups
4. **Document management** - UI to toggle is_public flag
5. **User directory** - View all users in owner group (admins only)
6. **Audit log** - Track permission changes

## File Locations

**Migrations:**
- `/migrations/add_permission_system.sql`
- `/migrations/add_document_visibility.sql`

**Server:**
- `/lib/routes/permissions.js`
- `/lib/middleware/check-document-access.js`
- `/lib/routes/chat.js` (updated with permission checks)

**React:**
- `/app-src/src/types/permissions.ts`
- `/app-src/src/lib/supabase/permissions.ts`
- `/app-src/src/hooks/usePermissions.ts`
- `/app-src/src/components/Dashboard/OwnerGroups.tsx`
- `/app-src/src/components/Dashboard/PermissionsBadge.tsx`

## Summary

✅ **Three-tier permission system** implemented
✅ **Database schema** extended with roles and access tables
✅ **RLS policies** enforce permissions at database level
✅ **API endpoints** for permission management
✅ **Permission checks** in chat API
✅ **React dashboard** displays user permissions
✅ **Backward compatible** - all public documents still work
✅ **Zero breaking changes** to existing functionality

The authorization foundation is complete and ready for administration UI and user management features!

