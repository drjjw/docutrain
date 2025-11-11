# Running Modes Reference Guide

This guide explains the different ways to run the application and how to distinguish between running from source vs. dist.

## Overview

The application can run in two main modes:
1. **Development Mode (Source)**: Running directly from the project root using source files
2. **Production Mode (Dist)**: Running from the `dist/` directory using built/processed files

The server automatically detects which mode it's running in and logs this information at startup.

## Running from Source vs. Dist

### Source Mode (Development)

**Location**: Project root directory (`/Users/jordanweinstein/GitHub/docutrain/`)

**Characteristics**:
- Uses original source files from `lib/`, `public/`, `server.js`
- React app served from `dist/app/` at `http://localhost:3458/app/*` (built/static version)
- Backend changes reload automatically with nodemon
- React changes require rebuild (`npm run build:app`) unless using Vite dev server
- Better for active development and debugging

**How to Run**:
```bash
# From project root - backend only (serves built React app from dist/app)
node server.js

# Or with nodemon (auto-restart on file changes) - still serves built React app
npm run dev

# Access React app at: http://localhost:3458/app/dashboard
# Access vanilla chat at: http://localhost:3458/chat

# For React hot reload during development, use:
npm run dev:all  # Starts both backend + Vite dev server
```

**Important Notes**:
- `npm run dev` **does** serve your React app at `http://localhost:3458/app/*`, but it's the **built/static version** from `dist/app/`
- For hot reload of React components, you need `npm run dev:app` (Vite dev server on port 5173) or `npm run dev:all` (both servers)
- The built React app must exist in `dist/app/` (run `npm run build:app` first if needed)

**Console Output**:
```
============================================================
🚀 RUNNING MODE: DEVELOPMENT (root)
📁 Working directory: /Users/jordanweinstein/GitHub/docutrain
📦 Running from: source (original files)
============================================================

🔄 Starting RAG-only server...
```

### Dist Mode (Production)

**Location**: `dist/` directory (`/Users/jordanweinstein/GitHub/docutrain/dist/`)

**Characteristics**:
- Uses built/processed files copied to `dist/`
- React app served from `dist/app/` (production build)
- All static files processed and optimized
- Better for testing production builds and deployment

**How to Run**:
```bash
# From project root - builds first, then runs dist
npm run test:dist

# From project root - runs existing dist build
npm run start:dist

# Or directly from dist directory
cd dist
node server.js
```

**Console Output**:
```
🔄 Starting RAG-only server from PRODUCTION (dist/)...
📁 Working directory: /Users/jordanweinstein/GitHub/docutrain/dist
```

## PM2 Process Manager Modes

PM2 is a production process manager for Node.js applications. Here are the different ways to use it:

### 1. Direct PM2 Start (Production)

Start a process directly with PM2:

```bash
# From project root (source mode)
pm2 start server.js --name my-app

# From dist directory (production mode)
cd dist
pm2 start server.js --name my-app
```

**Characteristics**:
- Process runs in background
- Auto-restart on crashes
- Can survive server reboots (with `pm2 startup`)
- Manual restart required for code changes

### 2. PM2 with Ecosystem Config

Use a configuration file for more control:

```bash
# Using ecosystem config
pm2 start ecosystem.config.js --env production

# Or start a specific config
pm2 start ecosystem.config.js --env production --only docutrainio-bot
```

**Benefits**:
- Configure multiple apps in one file
- Environment-specific settings
- Graceful shutdown handling
- Health checks and monitoring
- Custom restart policies

**Example Config** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    },
    wait_ready: true,
    listen_timeout: 15000,
    // ... more config
  }]
};
```

### 3. PM2 Dev Mode (Development)

PM2-dev is a development tool that provides watch mode and auto-restart:

```bash
# Install pm2-dev globally (if not installed)
npm install -g pm2-dev

# Run in development mode with watch
pm2-dev start server.js

# Or with ecosystem config
pm2-dev start ecosystem.config.js
```

**Characteristics**:
- Auto-restart on file changes (like nodemon)
- Watch mode for file system changes
- Better logging for development
- Not recommended for production

**Note**: `pm2-dev` is separate from PM2 and needs to be installed separately. For most development, `npm run dev` (nodemon) or `npm run dev:all` is sufficient.

### 4. PM2 Commands Reference

**Basic Operations**:
```bash
pm2 start server.js --name my-app    # Start process
pm2 stop my-app                       # Stop process
pm2 restart my-app                    # Restart process
pm2 reload my-app                     # Zero-downtime reload
pm2 delete my-app                     # Remove from PM2
pm2 list                              # List all processes
pm2 logs my-app                       # View logs
pm2 monit                             # Monitor dashboard
```

**Management**:
```bash
pm2 save                              # Save current process list
pm2 startup                           # Enable PM2 on system boot
pm2 kill                              # Kill PM2 daemon
```

**Multiple Processes**:
```bash
pm2 start all                          # Start all saved processes
pm2 stop all                           # Stop all processes
pm2 restart all                         # Restart all processes
pm2 delete all                          # Remove all processes
```

## Detection Mechanism

The server automatically detects which mode it's running in by checking if `__dirname` ends with `/dist`:

```javascript
const runningFrom = __dirname.endsWith('/dist') 
  ? 'PRODUCTION (dist/)' 
  : 'DEVELOPMENT (root)';
console.log(`🔄 Starting RAG-only server from ${runningFrom}...`);
```

This check happens at server startup and is logged prominently in the console.

## Recommended Workflows

### Active Development

**Option 1: With React Hot Reload (Recommended)**
```bash
# Start both backend + frontend dev servers
npm run dev:all

# IMPORTANT: Use the correct port for what you want:
# ✅ React app with hot reload (HMR): http://localhost:5173/app/dashboard
#    - This is the Vite dev server (source files, instant updates)
# ❌ Built React app (NO hot reload): http://localhost:3458/app/dashboard
#    - This is Express serving the built dist/app (static, no hot reload)

# Vanilla chat app (no hot reload): http://localhost:3458/chat?doc=tx-tips
#   Note: Vanilla JS changes require browser refresh
```

**Option 2: Backend Only (Serves Built React App)**
```bash
# Build React app first (if not already built)
npm run build:app

# Start backend - serves built React app from dist/app
npm run dev

# React app (static, no hot reload): http://localhost:3458/app/dashboard
# Vanilla chat app (no hot reload): http://localhost:3458/chat?doc=tx-tips
# Note: Both React and vanilla JS changes require rebuild/refresh
```

**Option 3: Separate Terminals**
```bash
# Terminal 1: Start backend with auto-reload
npm run dev  # Serves built React at http://localhost:3458/app (NO hot reload)

# Terminal 2: Start frontend dev server for hot reload
npm run dev:app  # React dev server at http://localhost:5173/app (WITH hot reload)

# ⚠️ IMPORTANT: Access http://localhost:5173/app (not 3458) for hot reload!
```

### Testing Production Build Locally
```bash
# Build everything
npm run build

# Test production build
npm run start:dist

# Access at: http://localhost:3458/app
```

### Production Deployment
```bash
# Build and deploy
npm run build
cd dist

# Start with PM2
pm2 start server.js --name my-app
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

### Development with PM2 (Optional)
```bash
# Using pm2-dev for watch mode
pm2-dev start server.js --name my-app-dev

# Or using regular PM2 (manual restart required)
pm2 start server.js --name my-app-dev
# Changes require: pm2 restart my-app-dev
```

## Hot Reload Behavior

### React App (from `app-src/`)
- **With Vite dev server** (`npm run dev:app` or `npm run dev:all`):
  - ✅ **Hot Module Replacement (HMR)** enabled
  - Access at: `http://localhost:5173/app/dashboard` (default port 5173)
  - Changes to React components update instantly without page refresh
  - CSS changes also hot-reload
  
- **Served by Express** (`npm run dev` only):
  - ❌ **No hot reload** - serves built/static version from `dist/app/`
  - Access at: `http://localhost:3458/app/dashboard`
  - Changes require: `npm run build:app` + browser refresh

### Vanilla JavaScript Chat App (from `public/`)
- **Served by Express** (any mode):
  - ❌ **No hot reload** - static files served directly
  - ✅ **No rebuild required** - files are served directly from `public/`
  - Access at: `http://localhost:3458/chat?doc=tx-tips`
  - Changes require: **Just browser refresh** (F5 or Cmd+R)
  - Edit files in `public/js/`, `public/css/`, `public/chat.html` → refresh browser → done!
  - Note: With `npm run dev` (nodemon), backend file changes restart the server, but vanilla JS files are still static (no rebuild needed)

### Summary
| URL | Hot Reload? | Rebuild Required? | How to See Changes |
|-----|------------|-------------------|-------------------|
| `http://localhost:5173/app/*` | ✅ Yes (HMR) | ❌ No | Instant (automatic) |
| `http://localhost:3458/app/*` | ❌ No | ✅ Yes (`npm run build:app`) | Build + browser refresh |
| `http://localhost:3458/chat` | ❌ No | ❌ No | Just browser refresh |

## Key Differences Summary

| Feature | Source Mode | Dist Mode |
|---------|------------|-----------|
| **Location** | Project root | `dist/` directory |
| **File Source** | Original source files | Built/processed files |
| **React App** | Can use Vite dev server | Production build only |
| **Hot Reload** | Available via Vite (React) | Manual restart required |
| **Build Step** | Not required for backend | Required before running |
| **Best For** | Active development | Testing production |
| **Console Message** | `DEVELOPMENT (root)` | `PRODUCTION (dist/)` |

## Troubleshooting

### Check Which Mode You're Running

1. **Check the console output** - Look for the startup message that says "DEVELOPMENT (root)" or "PRODUCTION (dist/)"

2. **Check working directory**:
   ```bash
   # The server logs its working directory at startup
   # Look for: 📁 Working directory: /path/to/dir
   ```

3. **Check process location**:
   ```bash
   # Find where the process is running from
   ps aux | grep "node.*server.js"
   # Or for PM2
   pm2 describe my-app | grep "exec cwd"
   ```

### Switch Between Modes

**From Source to Dist**:
```bash
npm run build
npm run start:dist
```

**From Dist to Source**:
```bash
# Kill any running processes
lsof -ti:3458 | xargs kill -9

# Or if using PM2
pm2 stop all
pm2 delete all

# Start from root
node server.js
```

## Environment Variables

Both modes use the same `.env` file from the project root. Make sure your `.env` file contains:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY` (optional)
- `PORT` (optional, defaults to 3458)

The `.env` file should be in the project root, and both source and dist modes will load it via `require('dotenv').config()`.

## Quick Reference

```bash
# Development (Source)
npm run dev              # Backend (serves built React at :3458/app, no hot reload)
npm run dev:app          # Frontend dev server only (Vite on :5173/app, with hot reload)
npm run dev:all          # Both concurrently (best for active development)

# Production (Dist)
npm run build            # Build everything
npm run start:dist       # Run from dist

# PM2 (Production)
pm2 start server.js --name my-app
pm2 restart my-app
pm2 logs my-app
pm2 stop my-app
pm2 delete my-app

# PM2 with Config
pm2 start ecosystem.config.js --env production
pm2 restart ecosystem.config.js

# PM2 Dev (Development)
pm2-dev start server.js --name my-app-dev
```

