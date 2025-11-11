# Repository Rename Guide: chat → docutrain

This guide will help you safely rename your repository from `chat` to `docutrain`.

## Current State
- **Local directory**: `/Users/jordanweinstein/GitHub/chat`
- **GitHub remote**: `https://github.com/drjjw/smh-chatbot.git`
- **Package name**: `pdf-chatbot`

## Step-by-Step Process

### Step 1: Update package.json (Local Changes)
Update the package name to match the new repository name:

```bash
# Update package.json name field
# Change: "name": "pdf-chatbot"
# To: "name": "docutrain"
```

### Step 2: Rename GitHub Repository (On GitHub Website)
1. Go to https://github.com/drjjw/smh-chatbot
2. Click **Settings** (top right of repository page)
3. Scroll down to **Repository name** section
4. Change name from `smh-chatbot` to `docutrain`
5. Click **Rename**

⚠️ **Note**: GitHub will automatically redirect old URLs, but update your remotes.

### Step 3: Update Git Remote URL (Local)
After renaming on GitHub, update your local git remote:

```bash
cd /Users/jordanweinstein/GitHub/chat
git remote set-url origin https://github.com/drjjw/docutrain.git
git remote -v  # Verify the change
```

### Step 4: Rename Local Directory (Optional but Recommended)
```bash
# From parent directory
cd /Users/jordanweinstein/GitHub
mv chat docutrain
cd docutrain
```

### Step 5: Update Hardcoded Paths in Documentation (Optional)
Many documentation files contain hardcoded paths like `/Users/jordanweinstein/GitHub/chat`. 

**Files to update** (if you want to keep docs accurate):
- `docs/getting-started/RUNNING-MODES.md`
- `docs/getting-started/DEVELOPMENT.md`
- `docs/deployment/DOCUTRAIN-DEPLOYMENT.md`
- `docs/deployment/DEPLOYMENT-TROUBLESHOOTING-OCT-2024.md`
- `docs/deployment/DEPLOYMENT-TROUBLESHOOTING-OCT-2025.md`
- `docs/deployment/DEPLOYMENT-CHECKLIST-LAZY-LOADING.md`
- `docs/api-docs/TESTING_GUIDE.md`
- `docs/refactoring/UI-REFACTOR-COMPLETE.md`
- `docs/refactoring/UI-REFACTOR-SUMMARY.md`
- `docs/docs-setup/*.md` (multiple files)
- `docs/database/DATABASE-DUMP-GUIDE.md`
- `scripts/chunk-and-embed-with-abstract-test.js`

**Search and replace pattern**:
```bash
# From the new docutrain directory
find docs scripts -type f -name "*.md" -o -name "*.js" | xargs sed -i '' 's|/Users/jordanweinstein/GitHub/chat|/Users/jordanweinstein/GitHub/docutrain|g'
```

### Step 6: Commit and Push Changes
```bash
# Stage all changes
git add .

# Commit the changes
git commit -m "Rename repository to docutrain"

# Push to the renamed repository
git push origin main
```

### Step 7: Verify Everything Works
```bash
# Verify remote is correct
git remote -v

# Verify you can push/pull
git pull origin main
git push origin main

# Check package.json was updated
cat package.json | grep '"name"'
```

## Important Notes

### What Gets Updated Automatically
- ✅ GitHub will redirect old repository URLs
- ✅ Git remotes need manual update (Step 3)
- ✅ Local directory name needs manual update (Step 4)

### What Needs Manual Updates
- ⚠️ Package.json name (Step 1)
- ⚠️ Git remote URL (Step 3)
- ⚠️ Local directory name (Step 4)
- ⚠️ Hardcoded paths in docs (Step 5 - optional)

### What Won't Break
- ✅ Existing clones will continue to work (with old URL)
- ✅ GitHub will redirect old URLs automatically
- ✅ CI/CD pipelines may need remote URL updates
- ✅ Any external references to the old repository name

## Quick Command Summary

```bash
# 1. Update package.json (manual edit or sed)
sed -i '' 's/"name": "pdf-chatbot"/"name": "docutrain"/' package.json

# 2. Rename on GitHub (do this manually on GitHub website)

# 3. Update git remote
git remote set-url origin https://github.com/drjjw/docutrain.git

# 4. Rename local directory
cd /Users/jordanweinstein/GitHub && mv chat docutrain && cd docutrain

# 5. Update hardcoded paths (optional)
find docs scripts -type f \( -name "*.md" -o -name "*.js" \) -exec sed -i '' 's|/Users/jordanweinstein/GitHub/chat|/Users/jordanweinstein/GitHub/docutrain|g' {} +

# 6. Commit and push
git add .
git commit -m "Rename repository to docutrain"
git push origin main
```

## Rollback Plan

If something goes wrong:

```bash
# Revert git remote
git remote set-url origin https://github.com/drjjw/smh-chatbot.git

# Rename directory back
cd /Users/jordanweinstein/GitHub && mv docutrain chat

# Revert package.json
git checkout package.json
```

---

**Created**: 2025-01-XX
**Status**: Ready to execute

