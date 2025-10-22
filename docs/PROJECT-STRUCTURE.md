# Project Structure

This document describes the organization of the project directory.

## Root Directory Files

- `server.js` - Main server entry point
- `build.js` - Build script for production
- `ecosystem.config.js` - PM2 configuration
- `package.json` / `package-lock.json` - Node.js dependencies
- `.env` / `.env.local` - Environment configuration
- `.gitignore` - Git ignore rules
- `.htaccess` - Apache configuration

## Directories

### `/lib`
Core application libraries and modules:
- `document-registry.js` - Document management
- `embedding-cache.js` - Embedding caching layer
- `local-embeddings.js` - Local embedding generation
- `middleware.js` - Express middleware
- `rag.js` - RAG (Retrieval-Augmented Generation) implementation
- `utils.js` - Utility functions
- `/routes` - API route handlers

### `/public`
Frontend static assets:
- `/css` - Stylesheets
- `/js` - Client-side JavaScript
- `/logos` - Logo images
- `index.html` - Main HTML file

### `/dist`
Production build output (generated, not edited directly)

### `/scripts`
Utility and maintenance scripts:
- Database dump/restore scripts
- Training and embedding scripts
- Deployment scripts (`deploy.sh`, `deploy2.sh`)
- Utility scripts (`benchmark-ai.js`, `check-downloads.js`)

### `/migrations`
Database migration SQL files

### `/tests`
Test files and test utilities:
- Unit tests
- Integration tests
- Test HTML pages

### `/examples`
Demo and example files:
- `FEATURE-DEMO.html` - Feature demonstration
- `embed-*.html` - Embedding examples
- `encoding-*.html` - Encoding examples
- `pubmed-demo.html` - PubMed integration demo

### `/training-data`
Training data and batch processing files:
- `documents-to-train.json` - Document training configuration
- `documents-to-train-example.json` - Example configuration
- `/ajkd-batch-files` - AJKD batch processing files
- `ajkd-batch-training.log` - Training logs

### `/PDFs`
PDF document storage:
- `/ajkd-core-curriculum` - AJKD curriculum PDFs
- `/books` - Medical textbooks
- `/guidelines` - Clinical guidelines
- `/manuals` - Training manuals
- `/slides` - Presentation slides
- `/thumbs` - PDF thumbnails

### `/docs`
Project documentation (99 markdown files)

### `/database-dumps`
Database backup files

### `/supabase`
Supabase configuration and schema

### `/node_modules`
Node.js dependencies (managed by npm)

