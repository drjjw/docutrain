# PubMed Integration for KDIGO Guidelines

**Date:** October 18, 2025  
**Purpose:** Link each clinical guideline to its PubMed entry for easy reference and citation

## Overview

All KDIGO guidelines now include PubMed metadata stored in the `metadata` JSON field of the `documents` table. This provides:

- **Direct PubMed links** for easy access to the official publication
- **PMID (PubMed ID)** for citation and reference
- **Automatic URL generation** from PMID
- **Integration with batch training** for new documents

## Current PubMed Links

### KDIGO Guidelines with PubMed IDs

| Guideline | Year | PMID | PubMed URL |
|-----------|------|------|------------|
| ADPKD | 2025 | 39848746 | https://pubmed.ncbi.nlm.nih.gov/39848746/ |
| ANCA Vasculitis | 2024 | 38388102 | https://pubmed.ncbi.nlm.nih.gov/38388102/ |
| Blood Pressure | 2021 | 33637192 | https://pubmed.ncbi.nlm.nih.gov/33637192/ |

## Database Structure

### Metadata JSON Format

PubMed information is stored in the `metadata` JSONB column:

```json
{
  "source": "KDIGO",
  "guideline_type": "ADPKD",
  "version": "2025",
  "pubmed_id": "39848746",
  "pubmed_url": "https://pubmed.ncbi.nlm.nih.gov/39848746/"
}
```

### Querying PubMed Data

```sql
-- Get all documents with PubMed links
SELECT 
    slug, 
    title, 
    metadata->>'pubmed_id' as pubmed_id,
    metadata->>'pubmed_url' as pubmed_url
FROM documents 
WHERE metadata->>'pubmed_id' IS NOT NULL;

-- Search by PMID
SELECT * FROM documents 
WHERE metadata->>'pubmed_id' = '39848746';

-- Get documents missing PubMed links
SELECT slug, title FROM documents 
WHERE metadata->>'pubmed_id' IS NULL 
  AND slug LIKE 'kdigo%';
```

## Batch Training Integration

### Configuration Format

When adding new documents via batch training, include the `pubmedId` field:

```json
{
  "documents": [
    {
      "slug": "kdigo-ckd-2024",
      "title": "KDIGO CKD Clinical Practice Guideline",
      "year": "2024",
      "pdfFilename": "KDIGO-2024-CKD-Guideline.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "both",
      "pubmedId": "12345678",
      "metadata": {
        "source": "KDIGO",
        "guideline_type": "CKD"
      }
    }
  ]
}
```

### Automatic Processing

The batch training script automatically:
1. Adds `pubmed_id` to metadata
2. Generates `pubmed_url` from the PMID
3. Stores both in the database

## Finding PubMed IDs

### Method 1: Direct Search

1. Go to https://pubmed.ncbi.nlm.nih.gov/
2. Search for: `"KDIGO" "[guideline topic]" "[year]"`
3. Click on the result
4. Copy the PMID from the URL (e.g., `39848746`)

### Method 2: KDIGO Website

1. Visit https://kdigo.org/guidelines/
2. Find the guideline
3. Look for "PubMed" link or citation
4. Extract PMID from the link

### Method 3: Brave Search

```bash
# Use the web search to find PMID
"KDIGO 2024 ANCA vasculitis guideline PubMed PMID"
```

### Example Searches

- **ADPKD 2025**: `KDIGO 2025 ADPKD autosomal dominant polycystic kidney disease guideline PubMed`
- **BP 2021**: `KDIGO 2021 blood pressure hypertension CKD guideline PubMed`
- **ANCA 2024**: `KDIGO 2024 ANCA vasculitis guideline update PubMed`

## Manual Updates

### Update Existing Document

```sql
-- Add PubMed ID and URL to existing document
UPDATE documents 
SET metadata = jsonb_set(
    jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{pubmed_id}',
        '"39848746"'::jsonb
    ),
    '{pubmed_url}',
    '"https://pubmed.ncbi.nlm.nih.gov/39848746/"'::jsonb
)
WHERE slug = 'kdigo-adpkd-2025';
```

### Bulk Update Multiple Documents

```sql
-- Update multiple documents with same PMID (e.g., both embedding types)
UPDATE documents 
SET metadata = jsonb_set(
    jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{pubmed_id}',
        '"39848746"'::jsonb
    ),
    '{pubmed_url}',
    '"https://pubmed.ncbi.nlm.nih.gov/39848746/"'::jsonb
)
WHERE slug IN ('kdigo-adpkd-2025', 'kdigo-adpkd-2025-local');
```

## Frontend Integration

### Accessing PubMed Data

In JavaScript/TypeScript:

```javascript
// From document config
const pubmedId = config.metadata?.pubmed_id;
const pubmedUrl = config.metadata?.pubmed_url;

// Display link
if (pubmedUrl) {
  const link = document.createElement('a');
  link.href = pubmedUrl;
  link.textContent = `PubMed (PMID: ${pubmedId})`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
}
```

### Example UI Integration

```html
<!-- In document header -->
<div class="document-references">
  <a href="https://kdigo.org/" target="_blank">KDIGO Website</a>
  <a href="https://pubmed.ncbi.nlm.nih.gov/39848746/" target="_blank">
    PubMed (PMID: 39848746)
  </a>
</div>
```

## API Response Format

When the document registry returns document info, PubMed data is included:

```json
{
  "slug": "kdigo-adpkd-2025",
  "title": "KDIGO ADPKD Clinical Practice Guideline",
  "year": "2025",
  "backLink": "https://kdigo.org/",
  "metadata": {
    "source": "KDIGO",
    "guideline_type": "ADPKD",
    "version": "2025",
    "pubmed_id": "39848746",
    "pubmed_url": "https://pubmed.ncbi.nlm.nih.gov/39848746/"
  }
}
```

## Validation

### Check All Documents Have PubMed Links

```sql
SELECT 
    slug, 
    title,
    CASE 
        WHEN metadata->>'pubmed_id' IS NOT NULL THEN '✓'
        ELSE '✗'
    END as has_pubmed
FROM documents 
WHERE slug LIKE 'kdigo%'
ORDER BY created_at;
```

### Verify PubMed URLs

```sql
-- Check that URLs are properly formatted
SELECT 
    slug,
    metadata->>'pubmed_url' as url,
    CASE 
        WHEN metadata->>'pubmed_url' LIKE 'https://pubmed.ncbi.nlm.nih.gov/%/' THEN '✓'
        ELSE '✗'
    END as valid_format
FROM documents 
WHERE metadata->>'pubmed_id' IS NOT NULL;
```

## Benefits

### For Users
- **Easy access** to official publication
- **Citation information** readily available
- **Credibility** through direct link to peer-reviewed source
- **Additional context** from PubMed abstract and metadata

### For Developers
- **Structured metadata** in JSON format
- **Flexible storage** without schema changes
- **Easy querying** with JSONB operators
- **Automatic URL generation** from PMID

### For Research
- **Traceability** to original publication
- **Version tracking** through publication dates
- **Citation counting** via PubMed metrics
- **Related articles** through PubMed's recommendation system

## Future Enhancements

### Potential Additions

1. **Automatic PMID lookup** via PubMed API
2. **Citation count** from PubMed
3. **Publication date** from PubMed metadata
4. **Authors list** from PubMed
5. **Abstract** from PubMed API
6. **DOI** (Digital Object Identifier)
7. **Journal information** (name, volume, issue)

### PubMed API Integration

```javascript
// Example: Fetch metadata from PubMed API
async function fetchPubMedMetadata(pmid) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
  const response = await fetch(url);
  const data = await response.json();
  return data.result[pmid];
}
```

## Best Practices

### When Adding New Documents

1. **Search PubMed first** before adding the document
2. **Verify PMID** by visiting the PubMed link
3. **Include in config** when using batch training
4. **Update both versions** (OpenAI and local) with same PMID
5. **Test the link** after adding to database

### Maintenance

1. **Regular audits** to ensure all KDIGO guidelines have PMIDs
2. **Update PMIDs** if guidelines are republished
3. **Check for retractions** or corrections on PubMed
4. **Monitor for updates** to existing guidelines

## Troubleshooting

### PMID Not Found

If a PMID doesn't work:
1. Check if the guideline is published yet
2. Search PubMed with different terms
3. Check KDIGO website for alternative links
4. Contact KDIGO if publication is expected but not found

### Wrong PMID

If the link goes to wrong article:
1. Verify the PMID on PubMed
2. Update the database with correct PMID
3. Clear any caches
4. Test the new link

### Missing PubMed Entry

Some guidelines may not have PubMed entries:
- Pre-publication guidelines
- Updates not yet indexed
- Non-journal publications

In these cases, leave `pubmed_id` as null and use `back_link` for KDIGO website.

## Related Files

- `scripts/batch-train-documents.js` - Handles PubMed ID processing
- `documents-to-train-example.json` - Example configuration with PubMed IDs
- `lib/document-registry.js` - Loads documents with metadata
- `server.js` - Serves document metadata to frontend

## See Also

- [PubMed Help](https://pubmed.ncbi.nlm.nih.gov/help/)
- [KDIGO Guidelines](https://kdigo.org/guidelines/)
- [Batch Training Guide](BATCH-TRAINING-GUIDE.md)
- [Document Registry](plans/document-registry-refactor.md)

