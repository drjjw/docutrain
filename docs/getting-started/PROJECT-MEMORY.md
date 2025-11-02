# Project Memory

## Project Conversion Status

**✅ MIGRATION COMPLETE: This project has been fully migrated from vanilla JavaScript to React/TypeScript.**

### ⚠️ DEPRECATED: Original Vanilla JavaScript Version
- **Location**: Root `public/` folder
- **Status**: 🚫 **DEPRECATED - NO LONGER IN USE**
- **Entry Point**: `public/chat.html` (redirects to React app)
- **JavaScript Modules**: `public/js/` directory (archived for reference only)
  - All functionality has been migrated to React/TypeScript
  - These files are kept for historical reference only
  - **DO NOT USE** - Use React components instead

### ✅ ACTIVE: React/TypeScript Version
- **Location**: `app-src/` folder
- **Status**: ✅ **ACTIVE - THIS IS THE CURRENT VERSION**
- **Stack**: React + TypeScript + Vite
- **Entry Point**: `/app/chat` route (served via React Router)
- **Structure**:
  - `app-src/src/components/` - React components
  - `app-src/src/hooks/` - Custom React hooks
  - `app-src/src/pages/` - Page components (ChatPage.tsx is the main chat interface)
  - `app-src/src/services/` - API services
  - `app-src/src/utils/` - Utility functions

### Key Development Guidelines

1. **Use React/TypeScript Version**: All new development should be done in the React app (`app-src/`).
   - The vanilla JS version is deprecated and only kept for reference
   - If you need to understand old behavior, you can reference `public/js/` files

2. **Backend Compatibility**: The backend API (`lib/routes/`) is shared and remains consistent.

3. **Routing**: 
   - `/chat` route redirects to `/app/chat` (React version)
   - All chat functionality is now handled by React components

### Quick Reference Locations

- **✅ React Chat Page**: `app-src/src/pages/ChatPage.tsx`
- **✅ React Chat Components**: `app-src/src/components/Chat/`
- **✅ React Hooks**: `app-src/src/hooks/`
- **✅ API Service**: `app-src/src/services/`
- **🚫 DEPRECATED - Vanilla JS Chat**: `public/js/chat.js` (reference only)
- **🚫 DEPRECATED - Vanilla JS UI**: `public/js/ui.js`, `public/js/ui-*.js` (reference only)


