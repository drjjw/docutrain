# Document Selector Testing Guide

## Quick Testing Steps

### 1. Test with Maker Documents (Selector Enabled)
Navigate to any Maker document:
- `?doc=maker-foh`
- `?doc=maker-franchise-training`
- `?doc=maker-menu-deck`
- `?doc=maker-prep-recipes`

**Expected:**
- ✅ Document selector button appears in header
- ✅ Shows current document name
- ✅ Clicking opens dropdown with all 4 Maker documents
- ✅ Search filters documents in real-time
- ✅ Clicking a document navigates to it
- ✅ Current document is highlighted

### 2. Test with UKidney Documents (Selector Disabled)
Navigate to any UKidney document:
- `?doc=smh`
- `?doc=uhn`
- `?doc=kdigo-ckd-2024`

**Expected:**
- ✅ Document selector is completely hidden
- ✅ No selector button in header
- ✅ Normal header layout

### 3. Mobile Testing
Use browser dev tools to test mobile view (< 768px width):

**Expected:**
- ✅ Selector button appears (for Maker docs)
- ✅ Tapping opens bottom sheet (not dropdown)
- ✅ Overlay appears behind bottom sheet
- ✅ Tapping overlay closes selector
- ✅ Search and navigation work same as desktop

### 4. Interaction Testing

**Desktop:**
- Click selector button → Opens dropdown
- Click X button → Closes dropdown
- Click outside dropdown → Closes dropdown
- Press Escape key → Closes dropdown
- Type in search → Filters documents
- Click document → Navigates to document

**Mobile:**
- Tap selector button → Opens bottom sheet
- Tap X button → Closes bottom sheet
- Tap overlay → Closes bottom sheet
- Press Escape key → Closes bottom sheet
- Type in search → Filters documents
- Tap document → Navigates to document

## Database Verification

Check owner settings:
```sql
SELECT slug, name, document_selector 
FROM owners 
ORDER BY slug;
```

**Expected:**
- default: `false`
- maker-pizza: `true` ✓
- ukidney: `false`

Check Maker documents:
```sql
SELECT slug, title, owner, owner_id 
FROM documents 
WHERE owner = 'maker' 
ORDER BY title;
```

**Expected:** 4 documents all linked to maker-pizza owner

## API Testing

Test the documents endpoint:
```bash
curl http://localhost:3000/api/documents
```

**Expected:** Each document should have `ownerInfo` object:
```json
{
  "ownerInfo": {
    "slug": "maker-pizza",
    "name": "Maker Pizza",
    "documentSelector": true
  }
}
```

## Visual Checks

### Desktop Layout
- [ ] Selector appears centered in header
- [ ] Button has clean, modern design
- [ ] Dropdown appears below button
- [ ] Document list is scrollable
- [ ] Search input has icon
- [ ] Hover effects work smoothly
- [ ] Active document is highlighted

### Mobile Layout
- [ ] Selector button is full width
- [ ] Bottom sheet slides up from bottom
- [ ] Overlay dims background
- [ ] Touch targets are large enough
- [ ] Text is readable
- [ ] Animations are smooth

## Common Issues

### Selector Not Appearing
1. Check owner has `document_selector = true`
2. Check document has valid `owner_id`
3. Check browser console for errors
4. Verify `/api/documents` returns `ownerInfo`

### Selector Appears for Wrong Owner
1. Verify owner slug in database
2. Check document's `owner_id` foreign key
3. Clear browser cache and reload

### Search Not Working
1. Check browser console for JavaScript errors
2. Verify document titles are loading
3. Test with simple search terms

### Navigation Not Working
1. Check URL parameter format: `?doc=slug`
2. Verify document slug exists in database
3. Check for JavaScript errors

## Performance Checks

- [ ] Dropdown opens instantly (< 100ms)
- [ ] Search filters in real-time (< 50ms)
- [ ] Navigation is immediate
- [ ] No layout shifts when selector appears
- [ ] Smooth animations (60fps)

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (Desktop)
- [ ] Safari (iOS)
- [ ] Chrome (Android)

## Deployment Checklist

Before deploying:
1. [ ] Run `node build.js` to build dist files
2. [ ] Verify dist files include document-selector.js
3. [ ] Test on staging environment
4. [ ] Verify database migration applied
5. [ ] Check maker-pizza has `document_selector = true`
6. [ ] Test all 4 Maker documents
7. [ ] Verify selector hidden for other owners
8. [ ] Test mobile and desktop layouts
9. [ ] Clear any cached localStorage
10. [ ] Monitor for JavaScript errors

## RLS Considerations

When making RLS changes, verify:
- [ ] `/api/documents` endpoint still returns owner info
- [ ] Owner table is readable by anonymous users
- [ ] Documents table includes owner_id in SELECT
- [ ] No permission errors in browser console
- [ ] Document navigation still works

## Things to Watch For

1. **Owner Mismatch**: Documents showing from wrong owner
2. **Missing ownerInfo**: API not returning owner data
3. **Selector Always Visible**: Not checking `documentSelector` flag
4. **Search Case Sensitivity**: Should be case-insensitive
5. **Mobile Overlay**: Should prevent body scrolling when open
6. **URL Parameters**: Should preserve other params when navigating
7. **Current Document**: Should be highlighted in list
8. **Empty State**: Should show message when no documents match search

## Success Criteria

✅ Feature is complete when:
1. Selector appears only for owners with `document_selector = true`
2. Shows only documents from current owner
3. Search filters documents correctly
4. Navigation works on desktop and mobile
5. UI is responsive and beautiful
6. No JavaScript errors in console
7. No linting errors
8. Documentation is complete

