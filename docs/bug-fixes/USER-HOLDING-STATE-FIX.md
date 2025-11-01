# User Holding State Fix - October 31, 2025

## Problem
Users were being automatically assigned to a "Default Owner" group, which defeated the purpose of the approval workflow. The system was designed so that new users should remain in a **holding state** (no roles, no owner assignments) until an admin explicitly assigns them through the User Management UI.

## Root Cause
The "Default Owner" group existed in the `owners` table and was being used as a catch-all assignment. This was a remnant from earlier development and should never have been used for actual user assignments.

## Solution Implemented

### 1. Removed Default Owner Assignments
- Deleted all user role assignments to "Default Owner"
- Specifically fixed `kame@drjjw.com` who was incorrectly assigned to both "Default Owner" and "Maker Pizza"
- User is now correctly assigned ONLY to "Maker Pizza" as a `registered` user

### 2. Deleted Default Owner
- Removed the "Default Owner" from the `owners` table
- Set any documents that were assigned to Default Owner to `NULL` (unassigned)
- Applied migration: `remove_default_owner_completely.sql`

### 3. Verified Holding State Works
The system now correctly identifies users who need approval:

**User States After Fix:**
- `kame@drjjw.com`: `needs_approval=false` (assigned to Maker Pizza) ✅
- `limeliwa@drjjw.com`: `needs_approval=true` (no assignments - in holding state) ✅
- `shlomo@makerpizza.com`: `needs_approval=false` (owner_admin of Maker Pizza) ✅
- `drjweinstein@gmail.com`: `needs_approval=false` (super_admin) ✅

### 4. Admin UI Automatically Updated
Since the admin UI dynamically loads owners from the database via `getOwners()`, the "Default Owner" no longer appears in any dropdown menus. Admins must now explicitly choose a real owner group when assigning users.

## Current Owner Groups
The system now has only legitimate owner groups:
1. **UKidney Medical** - Medical nephrology documents
2. **Maker Pizza** - Restaurant training and operational documents
3. **CPD Network** - Continuing Professional Development network
4. **BloombergSen** - Bloomberg Sen financial documents

## User Workflow

### New User Signup
1. User signs up and confirms email
2. User has NO roles and NO owner assignments
3. `user_needs_approval(user_id)` returns `true`
4. User sees "Your account is pending approval" message on dashboard
5. User cannot access any documents until assigned

### Admin Assignment
1. Admin (super_admin or owner_admin) goes to User Management
2. Admin selects user and clicks "Edit Permissions"
3. Admin chooses:
   - **Role**: `registered`, `owner_admin`, or `super_admin`
   - **Owner Group**: One of the legitimate owner groups (if not super_admin)
4. User is now assigned and can access documents

## Database Functions

### `user_needs_approval(p_user_id uuid)`
Returns `true` if user has:
- No entries in `user_roles` table, AND
- No entries in `user_owner_access` table

This function is used by the frontend to show the "pending approval" message.

## Things to Check When Making RLS Changes

Since we modified user role assignments, here are things to verify:

1. **Document Access**: Ensure users can only see documents from their assigned owner groups
2. **User Management**: Verify owner_admins can only manage users in their own owner groups
3. **Super Admin Access**: Confirm super_admins still have system-wide access
4. **Holding State**: Test that new users without assignments see the approval message
5. **Multiple Owner Groups**: If a user is assigned to multiple groups, verify they see documents from all groups

## Related Files
- Migration: `/migrations/remove_default_owner_completely.sql`
- Frontend Hook: `/app-src/src/hooks/usePermissions.ts`
- Permissions Library: `/app-src/src/lib/supabase/permissions.ts`
- Dashboard Page: `/app-src/src/pages/DashboardPage.tsx`
- Users Table Component: `/app-src/src/components/Admin/UsersTable.tsx`

## Security Advisories
The system currently has some security warnings (not critical):
- Multiple functions have mutable search_path (should set `search_path` parameter)
- `user_permissions_summary` view is defined with SECURITY DEFINER
- Extensions installed in public schema (vector, pg_net)

These are existing issues and not related to this fix.

