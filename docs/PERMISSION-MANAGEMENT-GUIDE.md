# Permission Management Quick Reference

## Grant Access to New Users

### 1. Get User ID

**Option A - Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob/auth/users
2. Find user by email
3. Copy their UUID

**Option B - Via SQL:**
```sql
SELECT id, email FROM auth.users WHERE email = 'user@example.com';
```

### 2. Grant Owner Group Access

**Give user access to ukidney documents:**
```sql
INSERT INTO user_owner_access (user_id, owner_id)
VALUES (
  '<user-uuid>',
  (SELECT id FROM owners WHERE slug = 'ukidney')
);
```

**Give access to multiple owner groups:**
```sql
INSERT INTO user_owner_access (user_id, owner_id)
SELECT 
  '<user-uuid>',
  id
FROM owners 
WHERE slug IN ('ukidney', 'maker', 'cpdn');
```

### 3. Promote to Owner Admin

**Make user admin of ukidney:**
```sql
INSERT INTO user_roles (user_id, owner_id, role)
VALUES (
  '<user-uuid>',
  (SELECT id FROM owners WHERE slug = 'ukidney'),
  'owner_admin'
);
```

### 4. Promote to Super Admin

**Grant system-wide access:**
```sql
-- Super admins need at least one owner association
INSERT INTO user_roles (user_id, owner_id, role)
VALUES (
  '<user-uuid>',
  (SELECT id FROM owners WHERE slug = 'ukidney' LIMIT 1),
  'super_admin'
);
```

## Make Documents Private

### Mark Single Document as Private

```sql
UPDATE documents 
SET is_public = false, requires_auth = true
WHERE slug = 'smh';
```

### Mark All Documents from Owner as Private

```sql
UPDATE documents 
SET is_public = false, requires_auth = true
WHERE owner = 'ukidney';
```

### Make Document Require Auth (but still public)

```sql
-- Accessible to any logged-in user
UPDATE documents 
SET is_public = true, requires_auth = true
WHERE slug = 'smh';
```

## Check User Permissions

### View User's Current Access

```sql
SELECT * FROM user_permissions_summary 
WHERE user_id = '<user-uuid>';
```

### View All Users with ukidney Access

```sql
SELECT 
  u.email,
  ups.role,
  ups.owner_name
FROM user_permissions_summary ups
JOIN auth.users u ON u.id = ups.user_id
WHERE ups.owner_slug = 'ukidney'
ORDER BY ups.role, u.email;
```

### Check if User Can Access Document

```sql
SELECT user_has_document_access_by_slug(
  '<user-uuid>',
  'smh'
);
-- Returns: true or false
```

## Revoke Access

### Remove Owner Access

```sql
DELETE FROM user_owner_access 
WHERE user_id = '<user-uuid>' 
AND owner_id = (SELECT id FROM owners WHERE slug = 'ukidney');
```

### Demote from Admin

```sql
DELETE FROM user_roles 
WHERE user_id = '<user-uuid>' 
AND owner_id = (SELECT id FROM owners WHERE slug = 'ukidney');
```

## Common Queries

### List All Private Documents

```sql
SELECT slug, title, owner, is_public, requires_auth 
FROM documents 
WHERE is_public = false
ORDER BY owner, title;
```

### List All Owner Admins

```sql
SELECT 
  u.email,
  o.name as owner_name,
  ur.created_at
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
JOIN owners o ON o.id = ur.owner_id
WHERE ur.role = 'owner_admin'
ORDER BY o.name, u.email;
```

### List All Super Admins

```sql
SELECT DISTINCT
  u.email,
  ur.created_at
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'super_admin'
ORDER BY u.email;
```

### Count Users by Owner

```sql
SELECT 
  o.name as owner_name,
  COUNT(DISTINCT ups.user_id) as user_count
FROM user_permissions_summary ups
JOIN owners o ON o.id = ups.owner_id
GROUP BY o.name
ORDER BY user_count DESC;
```

## Testing Permission System

### Test Public Document Access

```bash
# Should work without auth
curl http://localhost:3456/?doc=smh
```

### Test Private Document Access

```bash
# Make document private first
# Then test - should fail
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test","doc":"smh","model":"gemini","sessionId":"test-123"}'
  
# Should return 403 with message about authentication
```

### Test Authenticated Access

```bash
# Get auth token from browser localStorage or Supabase
curl -X POST http://localhost:3456/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"test","doc":"smh","model":"gemini","sessionId":"test-123"}'
  
# Should work if user has ukidney access
```

## Quick Setup for Testing

### Create Test User with Full Access

```sql
-- 1. Get user ID after signup
SELECT id FROM auth.users WHERE email = 'test@example.com';

-- 2. Grant ukidney access
INSERT INTO user_owner_access (user_id, owner_id)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@example.com'),
  (SELECT id FROM owners WHERE slug = 'ukidney')
);

-- 3. Refresh dashboard - should see access!
```

### Mark Test Document as Private

```sql
-- Make one ukidney document private for testing
UPDATE documents 
SET is_public = false 
WHERE slug = 'smh';
```

Now:
- Unauthenticated users get 403
- Users without ukidney access get 403
- Users with ukidney access can chat ✅

## Default Behavior (All Documents Currently)

```
is_public = true
requires_auth = false
```

This means **all existing documents work exactly as before** - publicly accessible via URL without authentication. The permission system is ready but not enforced until you:
1. Mark documents as private (`is_public = false`)
2. Or require auth (`requires_auth = true`)

## Owner Group IDs (Reference)

```sql
SELECT id, slug, name FROM owners;
```

Current owners:
- ukidney: UKidney Medical
- maker: Maker Pizza
- cpdn: CPD Network
- default: Default Owner

## Support

See full documentation:
- `/docs/AUTHORIZATION-SYSTEM-COMPLETE.md` - Complete technical details
- `/migrations/add_permission_system.sql` - Permission tables schema
- `/migrations/add_document_visibility.sql` - Document visibility schema

