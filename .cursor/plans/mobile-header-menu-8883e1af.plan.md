<!-- 8883e1af-902f-4daf-8971-aa575a01c929 49b7d48d-0e26-483e-85de-a04b225b1951 -->
# Mobile Header Menu Optimization

## Overview

Redesign the mobile chat header for better space utilization by consolidating document selector and user menu into a single hamburger menu toggle that opens a full-screen overlay.

## Current Issues

- Mobile header is cramped with logo, title, document selector button, and user menu all competing for space
- Document selector and user menu buttons take up valuable right-side real estate
- Header becomes cluttered when both features are enabled

## Proposed Solution

### Layout Structure

**Mobile Header (≤768px):**

- **Left:** Logo (compact, ~32px height)
- **Center:** Document title (truncated with ellipsis)
- **Right:** Hamburger menu toggle button (only shows when document selector OR user menu is enabled)

**Full-Screen Menu Overlay:**

- Semi-transparent backdrop
- White panel sliding in from right
- Two sections with clear visual separation:

1. **Document Selector Section** (if enabled): Shows searchable list of documents
2. **User Menu Section** (if user is authenticated): Shows user email, dashboard/profile links, sign out

### Implementation Details

#### 1. HTML Changes (`/public/chat.html`)

- Add new hamburger menu toggle button in header (hidden by default, shown via JS when needed)
- Create new full-screen menu overlay structure with two sections
- Keep existing document selector and user menu DOM (reuse their content in the overlay)

#### 2. CSS Changes (`/public/css/responsive.css` and `/public/css/components.css`)

- Hide document selector button and user menu button on mobile when hamburger is active
- Style hamburger menu button (3 lines icon, positioned right)
- Create full-screen overlay styles:
- Fixed position, full viewport
- Semi-transparent backdrop
- Right-side slide-in panel (80-90% width)
- Smooth transitions
- Style two menu sections with clear dividers
- Ensure proper z-index layering

#### 3. JavaScript Changes (`/public/js/main.js` and new `/public/js/mobile-menu.js`)

- Create new `MobileMenu` class to manage the overlay
- Show/hide hamburger button based on:
- Screen width ≤768px AND
- (Document selector is enabled OR user is authenticated)
- Handle hamburger click to open overlay
- Handle backdrop click and escape key to close overlay
- Integrate with existing document selector functionality
- Integrate with existing user menu functionality
- Handle body scroll lock when menu is open

#### 4. Integration Points

- Document selector: When item clicked in mobile menu, navigate to document and close menu
- User menu: When sign out clicked, execute sign out and close menu
- Preserve all existing functionality for desktop view (no changes)

## Files to Modify

### Core Files

1. `/public/chat.html` - Add hamburger button and mobile menu overlay structure
2. `/public/css/responsive.css` - Mobile-specific styles for new menu
3. `/public/css/components.css` - Component styles for hamburger and menu sections
4. `/public/js/mobile-menu.js` - New module for mobile menu management
5. `/public/js/main.js` - Initialize mobile menu and coordinate with existing features

### Testing Considerations

- Test with document selector enabled only
- Test with user menu enabled only
- Test with both enabled
- Test with neither enabled (hamburger should be hidden)
- Test document navigation from mobile menu
- Test user sign out from mobile menu
- Verify desktop view remains unchanged
- Test on actual mobile devices (iOS Safari, Chrome Android)

## Key Design Decisions

1. **Logo visibility:** Keep logo visible in header when menu is open (user decision)
2. **Menu sections:** Show as separate sections with clear dividers (option 2b)
3. **Hamburger position:** Right side of header for easy thumb access
4. **Menu width:** 85% of screen width to allow partial backdrop visibility
5. **Animation:** Slide in from right with smooth 300ms transitiondbfff

### To-dos

- [ ] Add hamburger button and full-screen menu overlay structure to chat.html
- [ ] Create CSS styles for hamburger menu button in responsive.css
- [ ] Create CSS styles for full-screen menu overlay and sections
- [ ] Create new mobile-menu.js module with MobileMenu class
- [ ] Integrate document selector functionality into mobile menu
- [ ] Integrate user menu functionality into mobile menu
- [ ] Initialize mobile menu in main.js and coordinate visibility logic
- [ ] Hide original document selector and user menu buttons on mobile when hamburger is shown
- [ ] Test all mobile menu scenarios and verify desktop view unchanged