# Role Hierarchy and Permission System

## Overview

The DocuTrain permission system uses a hierarchical role structure where higher-level roles inherit all permissions from lower-level roles. This document clarifies how roles work and how upgrades are handled.

## Role Hierarchy

The system has three role levels, ordered from lowest to highest:

```
registered < owner_admin < super_admin
```

### Role Descriptions

1. **`registered`** (Basic User)
   - Basic access to documents in their assigned owner groups
   - Can view and interact with documents they have access to
   - Cannot manage users, documents, or owner settings

2. **`owner_admin`** (Owner Group Administrator)
   - **Inherits all `registered` permissions** PLUS:
   - Can manage users within their owner group
   - Can manage documents for their owner group
   - Can configure owner group settings (logo, branding, categories)
   - Can invite users to their owner group
   - Can assign `registered` role to users in their owner group

3. **`super_admin`** (System Administrator)
   - **Inherits all `owner_admin` permissions** PLUS:
   - Can manage all owner groups
   - Can assign any role to any user
   - Can access all documents regardless of owner group
   - System-wide administrative access

## Role Assignment and Upgrades

### When a User is Upgraded

When a user is upgraded from `registered` to `owner_admin` (or any higher role):

1. **The user's role in `user_roles` table is updated** to the new role
2. **Any redundant `user_owner_access` entries are automatically removed**
   - Admin roles inherit all registered user permissions
   - Explicit `user_owner_access` entries become redundant
   - The system automatically cleans these up via database triggers

### Example: Upgrading from Registered to Owner Admin

**Before Upgrade:**
- User has `registered` role in `user_roles` table for "CPD Network"
- User has entry in `user_owner_access` for "CPD Network"

**After Upgrade:**
- User has `owner_admin` role in `user_roles` table for "CPD Network"
- User's entry in `user_owner_access` for "CPD Network" is **automatically removed**
- User now has all registered permissions PLUS admin permissions
- User's designation is simply **"Admin | CPD Network"** (not "User | Admin | CPD Network")

### Why This Matters

- **Cleaner UI**: Users see only their highest role designation, not redundant lower-level roles
- **Simpler Permissions**: Admin roles automatically include all registered user permissions
- **Data Integrity**: Prevents duplicate permission entries that could cause confusion
- **Performance**: Fewer redundant entries mean faster permission checks

## Database Tables

### `user_roles`
Stores explicit role assignments. Each user can have:
- One `super_admin` role (with `owner_id = NULL` for global super admin)
- One `owner_admin` role per owner group
- One `registered` role per owner group (though this is typically handled via `user_owner_access`)

### `user_owner_access`
Stores access grants for `registered` users only. This table is:
- **ONLY** for users with the `registered` role
- **Automatically cleaned up** when users are upgraded to admin roles
- Not needed for `owner_admin` or `super_admin` users (they have automatic access)

## Automatic Cleanup

The system includes automatic cleanup mechanisms:

1. **Database Trigger**: When a user is assigned an admin role, any redundant `user_owner_access` entries are automatically removed
2. **API Handler**: The role update API explicitly cleans up redundant entries when assigning admin roles
3. **Migration Script**: One-time cleanup removes existing redundant entries from the database

## Display Logic

The frontend filters out `registered` roles when displaying user designations:

- If a user has both `registered` and `owner_admin` roles for the same owner group, only `owner_admin` is displayed
- This prevents confusing displays like "User: Admin CPD Network 8 User | CPD Network"
- Users see their highest role designation: "Admin | CPD Network"

## Best Practices

1. **When upgrading a user**: Simply assign the new role - cleanup happens automatically
2. **When downgrading a user**: Remove the admin role and ensure they have `user_owner_access` entry if needed
3. **For new users**: Start with `user_owner_access` entry (registered access), then upgrade to `owner_admin` when needed
4. **Don't manually manage**: Let the system handle cleanup automatically - don't manually add/remove `user_owner_access` for admin users

## Migration Notes

The migration `cleanup_redundant_user_owner_access.sql`:
- Removes existing redundant `user_owner_access` entries
- Creates automatic cleanup triggers
- Updates table comments to clarify the role hierarchy
- Ensures future role assignments automatically clean up redundant entries





