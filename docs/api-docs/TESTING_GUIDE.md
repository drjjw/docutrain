# Admin Redesign - Testing Guide

## What to Check After Deployment

### 1. Dashboard Page (`/app/dashboard`)

#### Visual Elements to Verify:
- [ ] **Welcome Banner** - Blue/indigo gradient header with user avatar (initials)
- [ ] **Permission Badges** - Shows correct role (Super Admin or Owner Admin with group name)
- [ ] **Tab Navigation** - "Documents & Uploads" and "User Management" tabs (if super admin)
- [ ] **Access Level Card** - Blue info box explaining your permissions
- [ ] **Upload Section** - Card with gradient file selector button
- [ ] **Documents Table** - Full table with all documents and inline editing

#### Functionality to Test:
- [ ] Click between Documents and Users tabs (super admin only)
- [ ] Upload a PDF file - should show file preview with size
- [ ] Click on any document field to edit inline
- [ ] Copy document link button works
- [ ] View document link opens in new tab
- [ ] Delete document with confirmation works

#### Things That May Need Attention:
- **RLS Policies**: When editing documents, ensure:
  - Regular users cannot access admin features
  - Owner admins can only edit documents in their owner groups
  - Super admins can edit all documents
  - Document visibility settings are respected
  - User permissions are checked before allowing edits

### 2. Profile Page (`/app/profile`)

#### Visual Elements to Verify:
- [ ] **Profile Header** - Blue/indigo gradient with large avatar
- [ ] **Account Info Card** - Shows email, status badge, and member since date
- [ ] **Security Settings Card** - Password change form with lock icons
- [ ] **Quick Actions** - "Back to Dashboard" button
- [ ] **Icons** - Email, checkmark, calendar, and lock icons display correctly

#### Functionality to Test:
- [ ] Change password form validation works
- [ ] Success message appears after password change
- [ ] Error messages display correctly
- [ ] Clear button resets the form
- [ ] Back to Dashboard button navigates correctly

### 3. Navigation Header

#### Visual Elements to Verify:
- [ ] **User Avatar** - Small gradient box with initials in top left
- [ ] **"Admin Portal"** title with user email below
- [ ] **Dashboard Button** - Active when on dashboard or admin routes
- [ ] **Users Button** - Only visible for super admins
- [ ] **Profile Button** - Active when on profile page
- [ ] **Sign Out Button** - Separated by vertical line

#### Functionality to Test:
- [ ] All navigation buttons work correctly
- [ ] Active states highlight properly
- [ ] Users button only appears for super admins
- [ ] Sign out works and redirects to login

### 4. Upload Component

#### Visual Elements to Verify:
- [ ] **File Selector** - Gradient blue/indigo button
- [ ] **Info Icon** - Next to "PDF files only" text
- [ ] **File Preview** - Shows PDF icon, filename, and size
- [ ] **Progress Bar** - Gradient blue/indigo when uploading

#### Functionality to Test:
- [ ] File selection works
- [ ] Upload progress shows correctly
- [ ] Success/error messages display
- [ ] File size is calculated and displayed

### 5. Route Redirects

Test these old URLs redirect correctly:
- [ ] `/app/admin/documents` → `/app/dashboard`
- [ ] `/app/admin/users` → `/app/users`
- [ ] `/app/admin` → `/app/dashboard`
- [ ] `/app/` → `/app/dashboard`
- [ ] `/app/random-path` → `/app/dashboard`

### 6. Permission-Based Access

#### Test as Regular User:
- [ ] Dashboard shows "You do not have permission" error
- [ ] Cannot see upload section
- [ ] Cannot see documents table
- [ ] Cannot access user management

#### Test as Owner Admin:
- [ ] Dashboard shows documents for their owner groups only
- [ ] Can upload documents
- [ ] Can edit documents in their owner groups
- [ ] Cannot edit documents outside their owner groups
- [ ] Cannot see Users tab
- [ ] Permission badge shows "Owner Admin - [Group Name]"

#### Test as Super Admin:
- [ ] Dashboard shows all documents
- [ ] Can upload documents
- [ ] Can edit any document
- [ ] Can see and access Users tab
- [ ] Permission badge shows "Super Admin"
- [ ] Users button appears in header

### 7. Responsive Design

Test on different screen sizes:
- [ ] **Mobile (< 640px)** - Cards stack vertically, navigation wraps properly
- [ ] **Tablet (640-1024px)** - Two-column layout on profile page
- [ ] **Desktop (> 1024px)** - Full layout with all features visible

### 8. Database RLS Checks

When making changes to documents, verify:
- [ ] **Document Ownership** - Can only edit documents you have permission for
- [ ] **Visibility Settings** - Public/private flags are respected
- [ ] **Auth Requirements** - requires_auth flag works correctly
- [ ] **Owner Groups** - Owner assignments are enforced
- [ ] **User Permissions** - user_documents table permissions work

**Important RLS Considerations:**
- After editing document visibility settings, test that:
  - Public documents are accessible without auth
  - Private documents require proper permissions
  - Owner group restrictions are enforced
  - User-specific permissions override general settings
- Check that triggers and functions still work:
  - Document creation triggers
  - Permission check functions
  - Chunk limit calculations

### 9. Browser Console

Check for errors in the browser console:
- [ ] No React errors or warnings
- [ ] No 404s for missing assets
- [ ] No authentication errors
- [ ] API calls succeed

### 10. Performance

Verify performance is acceptable:
- [ ] Dashboard loads in < 2 seconds
- [ ] Profile page loads instantly
- [ ] Document table renders smoothly
- [ ] Tab switching is instant
- [ ] No layout shifts or flashing

## Common Issues to Watch For

### Issue: Documents Table Not Loading
- Check browser console for API errors
- Verify user has proper permissions in database
- Check RLS policies on documents table

### Issue: Upload Not Working
- Check file size (must be < 50MB)
- Verify file is PDF format
- Check browser console for upload errors
- Verify storage bucket permissions

### Issue: Permission Badges Not Showing
- Check usePermissions hook is working
- Verify user has roles assigned in database
- Check owner_groups table has correct data

### Issue: Redirects Not Working
- Clear browser cache
- Check React Router is properly configured
- Verify basename="/app" is set correctly

### Issue: Styling Looks Wrong
- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+F5)
- Check Tailwind CSS is loading
- Verify build process completed successfully

## Success Criteria

The redesign is successful if:
1. ✅ All pages load without errors
2. ✅ Navigation works smoothly
3. ✅ Permissions are properly enforced
4. ✅ Upload functionality works
5. ✅ Document management works
6. ✅ Profile page is functional
7. ✅ Responsive design works on all devices
8. ✅ No console errors
9. ✅ Performance is acceptable
10. ✅ RLS policies are not broken

## Rollback Plan

If critical issues are found:
1. Restore backup files:
   ```bash
   cd /Users/jordanweinstein/GitHub/docutrain/app-src/src/pages
   mv AdminPage.tsx.backup AdminPage.tsx
   mv UsersAdminPage.tsx.backup UsersAdminPage.tsx
   ```

2. Revert routing changes in `AppRouter.tsx`

3. Rebuild:
   ```bash
   npm run build
   ```

4. Restart server:
   ```bash
   pm2 restart all
   ```

