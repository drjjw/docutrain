# AI Hint Message - Visual Layout

## Page Structure

```
┌─────────────────────────────────────────────────────────┐
│                      HEADER                              │
│  Logo    Title & Subtitle    About Icon                 │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                                                          │
│                  CHAT CONTAINER                          │
│                                                          │
│  • Welcome message                                       │
│  • User messages                                         │
│  • AI responses                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  ⓘ Ask our AI any question related to this content in any language!  ✕  │ ← NEW!
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  [Type your message here...]              [Send]        │
└─────────────────────────────────────────────────────────┘
```

## AI Hint Message Details

### Desktop View
```
┌──────────────────────────────────────────────────────────┐
│   Ask our AI any question related to this content in any language!    ✕  │
└──────────────────────────────────────────────────────────┘
     ↑                                                   ↑
   Text (12px, gray)                          Dismiss button
```

### Mobile View
```
┌────────────────────────────────────────────────┐
│ Ask our AI any question related to this content in any... ✕  │
└────────────────────────────────────────────────┘
   ↑                                         ↑
 Text (11px)                          Dismiss
```

## Interaction Flow

### First Visit
```
Page Load
    ↓
Wait 500ms
    ↓
Fade In Message
    ↓
User Sees Hint
    ↓
[User can dismiss or ignore]
```

### Dismissal Flow
```
User Clicks ✕
    ↓
Fade Out Animation (300ms)
    ↓
Set Cookie (ai_hint_dismissed = true, expires 365 days)
    ↓
Message Hidden
    ↓
[Stays hidden on future visits]
```

### Cookie Check Flow
```
Page Load
    ↓
Check Cookie
    ↓
Cookie Exists? ──Yes──> Hide Message (no animation)
    │
    No
    ↓
Show Message (with delay)
```

## CSS Classes

### Main Container
- `.ai-hint-message` - Main container with flex layout
- Background: #f8f9fa (light gray)
- Border: 1px solid #e5e5e5
- Padding: 8px 20px (desktop), 6px 16px (mobile)

### Text
- `.ai-hint-text` - Message text
- Font: 12px (desktop), 11px (mobile)
- Color: #666 (medium gray)
- Weight: 400 (normal)

### Dismiss Button
- `.ai-hint-dismiss` - Close button
- Size: 14px × 14px icon
- Color: #999 (light gray)
- Hover: #333 on #e0e0e0 background
- Transition: 0.2s ease

## States

### Default (Hidden)
```css
display: none;
opacity: 0;
```

### Visible
```css
display: flex;
opacity: 1;
transform: translateY(0);
```

### Dismissing
```css
opacity: 0;
transform: translateY(-10px);
transition: all 0.3s ease;
```

## Responsive Breakpoints

### Desktop (> 768px)
- Full padding: 8px 20px
- Font size: 12px
- Icon size: 14px

### Mobile (≤ 768px)
- Reduced padding: 6px 16px
- Font size: 11px
- Icon size: 12px

## Accessibility

- ✅ Keyboard accessible (button can be tabbed to)
- ✅ Screen reader friendly (title attribute on button)
- ✅ High contrast (meets WCAG AA standards)
- ✅ Touch-friendly (button has adequate hit area)
- ✅ No motion for users who prefer reduced motion

## Performance

- **Initial Load:** No impact (hidden by default)
- **Show Animation:** 500ms delay + fade-in
- **Dismiss Animation:** 300ms fade-out
- **Cookie Check:** < 1ms (synchronous)
- **Memory:** Minimal (single event listener)

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Requires JavaScript enabled
- ✅ Graceful degradation (no JS = no hint, app still works)

