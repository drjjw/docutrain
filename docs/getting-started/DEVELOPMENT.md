# Development Guide

This guide explains how to run the application in development mode (from source) and production mode (from dist).

## Quick Start

### Development Mode (Recommended for Development)

Run both backend and frontend servers from source:

```bash
npm run dev:all
```

This will start:
- **Backend API server** on `http://localhost:3458` (with hot reload via nodemon)
- **Vite dev server** on `http://localhost:5173` (React app with HMR)

Access the app at: `http://localhost:5173/app`

**Benefits:**
- ✅ No build step required
- ✅ Hot Module Replacement (HMR) - instant updates
- ✅ Fast React Fast Refresh
- ✅ Faster development cycle

### Production/Dist Mode (Testing Production Build)

To test the production build:

```bash
# Build and run (rebuilds everything)
npm run test:dist

# Or run existing build without rebuilding
npm run start:dist
```

This runs the server from the `dist/` directory, serving the production React build at `http://localhost:3458/app`.

## Available Scripts

### Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run backend server only (nodemon, port 3458) |
| `npm run dev:app` | Run Vite dev server only (port 5173) |
| `npm run dev:all` | Run both servers concurrently |

### Production Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build React app and copy files to dist |
| `npm run build:app` | Build React app only (Vite) |
| `npm run test:dist` | Build everything and run from dist |
| `npm run start:dist` | Run existing build from dist |
| `npm start` | Run server from project root (serves dist/app) |

## Development Workflow

### Typical Development Session

1. **Start development servers:**
   ```bash
   npm run dev:all
   ```

2. **Make changes:**
   - React components in `app-src/src/` will hot reload automatically
   - Backend changes in `lib/`, `server.js`, etc. will restart via nodemon

3. **Access your app:**
   - React app: `http://localhost:5173/app`
   - Backend API: `http://localhost:3458/api/*`
   - Static files: `http://localhost:3458/*` (serves from `public/`)

### Testing Production Build

Before deploying, test your production build:

```bash
# Build everything
npm run build

# Test production build
npm run start:dist
```

Visit `http://localhost:3458/app` to test the production version.

## Project Structure

```
/Users/jordanweinstein/GitHub/docutrain/
├── app-src/              # React app source (Vite)
│   ├── src/              # React components, pages, hooks
│   ├── index.html        # Entry HTML
│   └── vite.config.ts    # Vite configuration
├── dist/                 # Production build (generated)
│   ├── app/              # Built React app
│   ├── public/           # Static files (processed)
│   ├── lib/              # Backend modules (copied)
│   └── server.js         # Server (configured for dist)
├── lib/                  # Backend modules (source)
├── public/               # Static files (source)
├── server.js             # Main server (source)
└── package.json          # Dependencies and scripts
```

## Port Configuration

- **Port 3458**: Backend API server (Express)
- **Port 5173**: Vite dev server (development only)

The Vite dev server proxies `/api` requests to `localhost:3458`.

## Environment Variables

Make sure you have a `.env` file in the project root with required variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY` (optional, for RAG embeddings)
- `PORT` (optional, defaults to 3458)
- And others as needed...

## Troubleshooting

### Port 3458 Already in Use

If you get a "port already in use" error:

```bash
# Kill all processes on port 3458
lsof -ti:3458 | xargs kill -9

# Or if PM2 is managing the process
pm2 stop docutrainio-bot
pm2 delete docutrainio-bot
```

### Changes Not Reflecting

**In Development Mode:**
- React changes: Should auto-reload (check browser console)
- Backend changes: nodemon should auto-restart
- If not working, manually restart: `Ctrl+C` then `npm run dev:all`

**In Production Mode:**
- Must rebuild: `npm run build` then `npm run start:dist`

### Module Not Found Errors

If you see module errors when running from dist:
1. Ensure `npm install` was run in the project root
2. For dist specifically, you may need: `cd dist && npm install --production`

## Best Practices

1. **Use `npm run dev:all` for active development** - fastest feedback loop
2. **Test production builds regularly** - catch build-specific issues early
3. **Don't edit files in `dist/`** - they're generated; edit source files instead
4. **Keep `.env` secure** - don't commit it to git
5. **Rebuild before deploying** - always test the production build first

## Additional Commands

- `npm run embed` - Generate embeddings for documents
- `npm run embed:local` - Generate embeddings using local model
- `npm run compare` - Compare different embedding methods

