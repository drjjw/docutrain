# Project Memory

## Project Conversion Status

**This project is being actively converted from vanilla JavaScript to React/TypeScript.**

### Original Vanilla JavaScript Version
- **Location**: Root `public/` folder
- **Status**: ✅ Complete and fully functional
- **Entry Point**: `public/chat.html`
- **JavaScript Modules**: `public/js/` directory containing:
  - `chat.js` - Main chat functionality
  - `ui.js` - UI components and interactions
  - `api.js` - API communication
  - `document-selector.js` - Document selection UI
  - `user-auth.js` - Authentication
  - And other supporting modules

### New React/TypeScript Version
- **Location**: `app-src/` folder
- **Status**: 🔄 In progress (being ported)
- **Stack**: React + TypeScript + Vite
- **Structure**:
  - `app-src/src/components/` - React components
  - `app-src/src/hooks/` - Custom React hooks
  - `app-src/src/pages/` - Page components
  - `app-src/src/services/` - API services
  - `app-src/src/utils/` - Utility functions

### Key Development Guidelines

1. **Reference the Vanilla JS Version**: When implementing features in the React version, always refer to the corresponding vanilla JS code in `public/js/` for:
   - Functionality implementation details
   - API integration patterns
   - Business logic
   - UI behavior and interactions

2. **Backend Compatibility**: The backend API (`lib/routes/`) is shared between both versions, so API endpoints remain consistent.

3. **Feature Parity**: The goal is to port all functionality from the vanilla JS version to React/TypeScript while improving:
   - Type safety (TypeScript)
   - Component reusability (React)
   - Code organization and maintainability

### Quick Reference Locations

- **Vanilla JS Chat Implementation**: `public/js/chat.js`
- **Vanilla JS UI Components**: `public/js/ui.js`, `public/js/ui-*.js`
- **React Chat Page**: `app-src/src/pages/ChatPage.tsx`
- **React Chat Components**: `app-src/src/components/Chat/`
- **React Hooks**: `app-src/src/hooks/`
- **API Service**: `app-src/src/services/`

