# Mobile Layout Improvements

## Overview
Cleaned up the mobile header layout to improve visual hierarchy and centering.

## Changes Made (October 20, 2025)

### 1. Logo Position on Mobile
- **Before**: Logo appeared below the document title
- **After**: Logo now appears above the document title
- **Implementation**: Added `order: -1` to `.header-logo` in mobile media query

### 2. Back Button Centering
- **Before**: Back button alignment could be inconsistent
- **After**: Back button is now properly centered
- **Implementation**: 
  - Changed `.header` `align-items` from `stretch` to `center`
  - Added explicit centering to `.header-content` with flexbox
  - Ensured `.back-link` uses `align-self: center`

### 3. Overall Header Alignment
- All header elements now properly centered on mobile
- Improved visual flow: Logo → Title → Subtitle → Document Selector (if present) → Back Button (if present)

## Mobile Layout Order (Top to Bottom)

1. **Logo** (if present for the document owner)
2. **Document Title**
3. **Subtitle/PMID Link**
4. **Document Selector** (if enabled for owner)
5. **Back Button** (if URL parameter provided)

## CSS Changes

### Mobile Media Query (@media max-width: 768px)

```css
.header {
    align-items: center; /* Changed from stretch */
}

.header-logo {
    order: -1; /* Logo comes first on mobile */
}

.header-center {
    /* Removed order: -1 */
}

.header-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}
```

## Files Modified

- `public/css/styles.css`
- `dist/public/css/styles.css`

## Testing

On mobile devices (or browser dev tools with mobile viewport):
1. ✅ Logo appears above the title
2. ✅ Title is centered
3. ✅ Back button (when present) is centered
4. ✅ Document selector (when present) is centered
5. ✅ All elements maintain proper spacing

## Desktop Behavior

No changes to desktop layout - all modifications are scoped to the mobile media query only.

## Date
October 20, 2025





