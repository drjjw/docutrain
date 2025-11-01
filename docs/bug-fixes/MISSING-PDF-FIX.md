# Missing PDF File - Fatal Error Fix

**Date:** October 18, 2025  
**Issue:** Server crashed when KDIGO ADPKD PDF was missing from dist folder

## Problem Analysis

### Root Cause
When the new KDIGO ADPKD 2025 guideline was added to the database, the build script was not updated to include the PDF file in the distribution. This caused:

1. **Fatal Server Crash:** The server tried to load all active documents from the database registry
2. **No Error Handling:** When `fs.readFileSync()` failed on the missing PDF, it threw an unhandled error
3. **Complete Failure:** The entire server startup process terminated, preventing any documents from being served

### Why It Was Fatal

The original code in `server.js` (lines 1066-1069):
```javascript
for (const slug of activeDocs) {
    await loadPDF(slug);  // ❌ Throws error, crashes entire server
}
```

When the PDF file was missing, the error propagated up and crashed the entire Node.js process.

## Fixes Applied

### 1. Updated Build Script (`build.js`)

**Added missing PDF to line 211:**
```javascript
const pdfFiles = [
    { from: 'PDFs/manuals/smh-manual-2023.pdf', to: 'PDFs/manuals/smh-manual-2023.pdf' },
    { from: 'PDFs/manuals/uhn-manual-2025.pdf', to: 'PDFs/manuals/uhn-manual-2025.pdf' },
    { from: 'PDFs/manuals/Kidney-Transplant-Medications-Tip-Sheet-Aug-2024.pdf', to: 'PDFs/manuals/Kidney-Transplant-Medications-Tip-Sheet-Aug-2024.pdf' },
    { from: 'PDFs/guidelines/PIIS1499267125000206.pdf', to: 'PDFs/guidelines/PIIS1499267125000206.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf', to: 'PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf' }  // ✅ ADDED
];
```

### 2. Added Graceful Error Handling in `server.js`

#### A. File Existence Check (lines 126-129)
```javascript
// Check if PDF file exists before trying to load it
if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
}
```

#### B. Startup Error Recovery (lines 1072-1096)
```javascript
const loadedDocs = [];
const failedDocs = [];

for (const slug of activeDocs) {
    try {
        await loadPDF(slug);
        loadedDocs.push(slug);
    } catch (error) {
        console.error(`⚠️  Failed to load ${slug}:`, error.message);
        failedDocs.push({ slug, error: error.message });
    }
}

// Check if at least one document loaded successfully
if (loadedDocs.length === 0) {
    throw new Error('❌ No documents could be loaded. Server cannot start.');
}

if (failedDocs.length > 0) {
    console.warn(`\n⚠️  Warning: ${failedDocs.length} document(s) failed to load:`);
    failedDocs.forEach(({ slug, error }) => {
        console.warn(`   - ${slug}: ${error}`);
    });
    console.warn('   Server will continue with available documents.\n');
}
```

#### C. Runtime Error Handling (lines 593-605)
```javascript
// Ensure document is loaded
if (!documents[documentType]) {
    try {
        await loadPDF(documentType);
        setCurrentDocument(documentType);
    } catch (error) {
        console.error(`Failed to load document ${documentType}:`, error.message);
        return res.status(500).json({
            error: 'Document Loading Error',
            message: `The requested document (${documentType}) could not be loaded. The PDF file may be missing or corrupted.`,
            details: error.message
        });
    }
}
```

## Benefits of New Error Handling

### 1. **Graceful Degradation**
- Server starts even if some PDFs are missing
- Only requires at least ONE document to be available
- Failed documents are logged but don't crash the server

### 2. **Clear Error Messages**
- Startup logs show which documents failed and why
- Runtime errors return helpful JSON responses to the client
- Administrators can quickly identify missing files

### 3. **Better User Experience**
- Users can still access working documents
- Clear error messages when accessing unavailable documents
- No complete service outage

## Example Output

### Server Startup with Missing PDF
```
📄 Loading PDFs...
Loading smh document from registry...
✓ PDF loaded successfully
Loading uhn document from registry...
✓ PDF loaded successfully
Loading kdigo-adpkd-2025 document from registry...
⚠️  Failed to load kdigo-adpkd-2025: PDF file not found: /path/to/PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf

⚠️  Warning: 1 document(s) failed to load:
   - kdigo-adpkd-2025: PDF file not found: /path/to/PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf
   Server will continue with available documents.

🚀 Server running at http://localhost:3456
📚 Multi-document chatbot ready!
   - Loaded documents:
     • smh: Nephrology Manual (2023, openai)
     • uhn: Nephrology Manual (2025, openai)
   - Failed documents: kdigo-adpkd-2025
   - Default document: smh
```

### Runtime Error Response
If a user tries to access a failed document:
```json
{
  "error": "Document Loading Error",
  "message": "The requested document (kdigo-adpkd-2025) could not be loaded. The PDF file may be missing or corrupted.",
  "details": "PDF file not found: /path/to/PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf"
}
```

## Prevention Strategy

### For Future Document Additions

1. **Update build.js immediately** when adding new documents to the database
2. **Test the build** before deploying: `node build.js`
3. **Verify dist folder** contains all PDFs before deploying
4. **Check server logs** after deployment for any failed document loads

### Automated Checks (Future Enhancement)

Consider adding a validation script that:
- Queries database for all active documents
- Checks if corresponding PDF files exist
- Reports any mismatches before build/deploy

## Testing

To test the error handling:

1. **Remove a PDF temporarily:**
   ```bash
   mv PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf.bak
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

3. **Verify graceful handling:**
   - Server should start successfully
   - Warning message should appear in logs
   - Other documents should work normally

4. **Restore the PDF:**
   ```bash
   mv PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf.bak PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf
   ```

## Related Files Modified

- ✅ `build.js` - Added KDIGO PDF to build process
- ✅ `server.js` - Added comprehensive error handling
- ✅ `public/js/ui.js` - Fixed welcome message display (separate issue)

## Deployment Checklist

Before deploying to production:

- [ ] Run `node build.js` locally
- [ ] Verify all PDFs are in `dist/PDFs/` directory
- [ ] Check build output for any errors
- [ ] Test server startup with `cd dist && node server.js`
- [ ] Verify all documents load successfully
- [ ] Deploy dist folder to production
- [ ] Monitor production logs for any warnings


