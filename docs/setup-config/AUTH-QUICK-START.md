# React Auth App - Quick Start Guide

## Access the App

- **Main Chat App**: http://localhost:3456/
- **Auth Dashboard**: http://localhost:3456/app

## Development

### Start Dev Servers

```bash
# Terminal 1: Start Express server (serves both apps)
npm run dev

# Terminal 2: Start Vite dev server (hot reload for React)
npm run dev:app
```

Then access:
- React dev: http://localhost:5173 (hot reload)
- Production preview: http://localhost:3456/app (through Express)

### Make Changes

React components are in `/app-src/src/`:
- Edit components, they auto-reload with Vite
- Changes appear instantly in dev mode
- Run `npm run build:app` to test production build

## Create a Test User

1. Go to http://localhost:3456/app/signup
2. Enter email and password (minimum 6 characters)
3. Click "Sign Up"
4. You'll be redirected to the dashboard

## Test Features

### Upload a Document
1. Login to dashboard
2. Click "Choose File" in the Upload section
3. Select a PDF (max 50MB)
4. Click "Upload"
5. Document appears in "Your Documents" list with "Pending" status

### View Documents
- All your documents listed in dashboard
- Shows: title, status, file size, upload date
- Real-time updates when status changes

### Delete a Document
- Click "Delete" button on any document card
- Confirms before deleting
- Removes from both database and storage

## Database Access

View your data in Supabase:
```
Project: https://mlxctdgnojvkgfqldaob.supabase.co
Table: user_documents
```

## File Locations

### React App Source
```
/app-src/src/
  /components/  - UI components
  /hooks/       - Custom hooks
  /lib/         - Supabase clients and utilities
  /pages/       - Page components
  /routes/      - Router configuration
```

### Built Output
```
/dist/app/           - React app production build
/dist/public/        - Vanilla JS app
```

## Common Tasks

### Add a New Component
```typescript
// /app-src/src/components/MyComponent.tsx
import React from 'react';

export function MyComponent() {
  return <div>Hello World</div>;
}
```

### Add a Custom Hook
```typescript
// /app-src/src/hooks/useMyHook.ts
import { useState } from 'react';

export function useMyHook() {
  const [value, setValue] = useState('');
  return { value, setValue };
}
```

### Update Supabase Types
```typescript
// /app-src/src/types/document.ts
export interface UserDocument {
  // Add new fields here
}
```

## Environment Variables

React app uses Vite env vars (prefix with `VITE_`):
```bash
# /app-src/.env
VITE_SUPABASE_URL=https://mlxctdgnojvkgfqldaob.supabase.co
VITE_SUPABASE_ANON_KEY=<your-key>
```

## Troubleshooting

### React app not loading
- Check `/dist/app` exists: `ls -la dist/app`
- Rebuild: `npm run build:app`
- Check server logs for errors

### Auth not working
- Verify Supabase credentials in `/app-src/.env`
- Check browser console for errors
- Ensure `user_documents` table exists

### Upload failing
- File must be PDF
- Max size 50MB
- Check browser console for validation errors
- Verify storage bucket exists in Supabase

### Build errors
- Run `npm install` to ensure all dependencies installed
- Check for TypeScript errors: Files in `/app-src/src`
- Verify Tailwind CSS v3 installed (not v4)

## Next Development Steps

1. **Integrate Document Processing**
   - Connect upload to chunking scripts
   - Update document status after processing
   - Generate embeddings

2. **Add Chat Functionality**
   - Allow users to chat with their documents
   - Integrate with existing RAG system
   - Multi-document queries

3. **Polish UI**
   - Add loading states
   - Better error handling
   - Success notifications
   - Upload progress animations

## Production Deployment

```bash
# Build everything
npm run build

# Deploy /dist directory
# Both apps included:
# - /dist/public (vanilla JS)
# - /dist/app (React)
# - /dist/server.js
# - /dist/lib
```

## Security Notes

- **RLS enabled**: Users can only see their own documents
- **JWT validation**: All API requests authenticated
- **File validation**: Only PDFs, max 50MB
- **Secure storage**: Files in user-specific paths

## Support

Check these docs for more info:
- `/docs/REACT-AUTH-SETUP-COMPLETE.md` - Full implementation details
- `/docs/API_REFERENCE.md` - API documentation
- `/migrations/add_user_documents_table.sql` - Database schema

