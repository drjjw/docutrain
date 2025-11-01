# Documentation Directory

This directory contains all project documentation organized into logical subfolders for easy navigation.

## 📁 Directory Structure

### 🚀 Getting Started
**Location:** `getting-started/`

Essential documentation for new developers or users:
- Project overview and README
- Quick start guides
- Project structure and architecture
- Production checklists
- Implementation summaries

### ⚙️ Setup & Configuration
**Location:** `setup-config/`

Configuration guides and setup instructions:
- Authentication setup
- RAG (Retrieval-Augmented Generation) setup
- Edge function configuration
- URL parameters and configuration
- Batch training guides
- Embedding defaults

### ✨ Features
**Location:** `features/`

Documentation for all implemented features:
- Document selector
- Downloads functionality
- Streaming implementation
- Multi-document RAG
- AI hints and abstracts
- Back button navigation
- Page detection
- Model comparisons
- Webhooks and auto-refresh
- PDF processing improvements

### 🚢 Deployment
**Location:** `deployment/`

Deployment guides and production setup:
- Main deployment guides
- RAG deployment
- Deployment troubleshooting
- Multi-VPS architecture
- Domain switching
- Processing VPS setup

### ⚡ Performance & Optimization
**Location:** `performance/`

Performance analysis and optimization guides:
- Lazy loading optimization
- Performance logging
- Cache management
- PDF optimization
- Concurrency improvements
- VPS capacity analysis

### 🐛 Bug Fixes
**Location:** `bug-fixes/`

Documentation of bugs fixed during development:
- Error fixes (500 errors, timeouts)
- Embedding fixes
- Permission fixes
- UI fixes (mobile, refresh, etc.)
- PDF and document processing fixes

### 🔄 Refactoring
**Location:** `refactoring/`

Documentation of code refactoring efforts:
- Server refactoring summaries
- UI refactoring
- Main.js refactoring
- Processing routes refactoring
- Modular structure changes
- Document registry refactoring

### 📚 API & Documentation
**Location:** `api-docs/`

Technical API documentation:
- API reference
- Server module guide
- Testing guide
- URL encoding cheatsheets
- Admin CRUD guide
- Encoding how-to guides

### 🔧 Troubleshooting
**Location:** `troubleshooting/`

Troubleshooting guides for common issues:
- General troubleshooting
- Downloads troubleshooting
- Stuck document recovery

### 📝 Session Summaries
**Location:** `session-summaries/`

Date-stamped session summaries of development work.

### 🎨 UI/UX
**Location:** `ui-ux/`

User interface and user experience documentation:
- UI module quick reference
- Header redesigns
- Mobile layout improvements
- Admin redesign summaries

### 🔌 Integrations
**Location:** `integrations/`

External integration documentation:
- UKidney integration
- PubMed integration

### 🔐 Permissions & Access
**Location:** `permissions-access/`

Authorization and access control documentation:
- Permission system
- Permission management guides
- Document access guides
- RLS (Row Level Security) fixes
- Owner-based chunk limits

### 💾 Database
**Location:** `database/`

Database-related documentation:
- Database dump guides
- Migration guides
- Storage cascade delete
- Migration cleanup

### 📄 Document Processing
**Location:** `document-processing/`

Document processing and training documentation:
- Adding new documents
- Batch processing
- Page number system
- Troubleshooting document processing

### 🔮 Future Modifications
**Location:** `future-mods/`

Planned or proposed future modifications:
- Cache busting strategies
- Multi-doc conflict handling
- Multi-document RAG implementation ideas

### 📋 Setup-Specific Folders

#### `disclaimer-setup/`
Disclaimer feature setup documentation.

#### `docs-setup/`
Setup guides for specific document sets (AJKD, KDIGO guidelines, etc.).

## 📊 Statistics

- **Total Documentation Files:** 177 markdown files
- **Organized Categories:** 18 main folders
- **Features Documented:** 45+ feature implementations
- **Bug Fixes Documented:** 18+ bug fixes
- **Deployment Guides:** 12 deployment-related documents

## 🔍 Finding Documentation

### By Topic
- Need setup help? → `setup-config/` or `getting-started/`
- Looking for a feature? → `features/`
- Deployment issues? → `deployment/` or `troubleshooting/`
- Performance questions? → `performance/`
- API reference? → `api-docs/`

### By File Name Pattern
- `*-SUMMARY.md` → Usually in `features/`, `refactoring/`, or `deployment/`
- `*-FIX.md` → Bug fixes in `bug-fixes/`
- `*-GUIDE.md` → Setup or usage guides
- `*-QUICK-REFERENCE.md` → Quick lookup documentation
- `SESSION-SUMMARY-*.md` → Date-stamped summaries in `session-summaries/`

## 📝 Contributing

When adding new documentation:
1. Place files in the appropriate subfolder
2. Use descriptive, consistent naming (UPPERCASE with hyphens)
3. Include dates in session summaries
4. Cross-reference related documents

