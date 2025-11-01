# HTML Intro Messages - Quick Start Guide

## What Are Intro Messages?

Intro messages are customizable HTML welcome messages that appear when users first load a document. They replace the previous hard-coded intro text with database-driven content that can be customized per owner or per document.

## How It Works

### Priority System

1. **Document-level intro** (highest priority) - specific to one document
2. **Owner-level intro** (fallback) - default for all owner's documents  
3. **No intro** - nothing displays if both are NULL

### Example Scenario

- **UKidney Medical** (owner) has a default intro about nephrology AI
- **SMH Manual** (document) has a custom intro about the SMH manual specifically
- When viewing SMH Manual → shows SMH-specific intro (override)
- When viewing UHN Manual → shows UKidney default intro (no override)

## Setting Intro Messages

### Set Owner Default (All Documents)

```sql
UPDATE owners 
SET intro_message = 'Your HTML intro message here'
WHERE slug = 'ukidney';
```

### Set Document-Specific Override

```sql
UPDATE documents 
SET intro_message = 'Your HTML intro message here'
WHERE slug = 'smh';
```

### Clear Intro Messages

```sql
-- Clear document override (falls back to owner default)
UPDATE documents SET intro_message = NULL WHERE slug = 'smh';

-- Clear owner default
UPDATE owners SET intro_message = NULL WHERE slug = 'ukidney';
```

## Allowed HTML Tags

You can use these safe HTML tags in your intro messages:

- **Text formatting:** `<strong>`, `<em>`, `<b>`, `<i>`
- **Line breaks:** `<br>`
- **Lists:** `<ul>`, `<ol>`, `<li>`
- **Links:** `<a href="...">` (href only, no onclick)
- **Structure:** `<p>`, `<span>`, `<div>`

## Example Templates

### Basic Template

```html
This AI assistant helps answer questions about [topic].
<br><br>
<strong>Example questions:</strong>
<br>• Question 1
<br>• Question 2
<br>• Question 3
```

### With Lists

```html
Welcome to the <strong>Document Title</strong>.
<br><br>
<strong>Key features:</strong>
<ul>
  <li>Feature 1</li>
  <li>Feature 2</li>
  <li>Feature 3</li>
</ul>
```

### With Links

```html
This manual is maintained by <a href="https://example.com">Organization Name</a>.
<br><br>
For questions or feedback, visit our <a href="https://example.com/contact">contact page</a>.
```

## Current Configuration

### UKidney Medical (Owner Default)

```sql
SELECT intro_message FROM owners WHERE slug = 'ukidney';
```

Currently set to:
> This AI-powered assistant provides intelligent answers to your nephrology questions by searching through comprehensive medical manuals and guidelines. It combines advanced AI models with targeted document retrieval to deliver accurate, contextual responses.
> 
> **Example questions:**
> - "What are the indications for urgent dialysis initiation?"
> - "Compare hemodialysis versus peritoneal dialysis complications"
> - "How do you manage hyperkalemia in CKD patients?"
> - "What are the diagnostic criteria for IgA nephropathy?"

### SMH Manual (Document Override)

```sql
SELECT intro_message FROM documents WHERE slug = 'smh';
```

Currently set to:
> Welcome to the **St. Michael's Hospital Nephrology Manual** - an interactive AI assistant for residents, fellows, and clinicians.
> 
> This comprehensive manual covers essential nephrology topics including acute kidney injury, chronic kidney disease, dialysis, transplantation, and electrolyte disorders.
> 
> **Quick tips:**
> - Ask specific clinical questions for detailed answers
> - Request comparisons between treatment approaches
> - Inquire about diagnostic criteria and management protocols

## Viewing Changes

After updating intro messages:

1. **Server cache:** Refreshes automatically every 2 minutes (background job)
2. **Force refresh:** Call `/api/refresh-registry` endpoint
3. **Browser cache:** Expires automatically after 5 minutes OR clear localStorage key `ukidney-documents-cache-v2`
4. **Hard refresh:** Reload the page with Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

**For immediate updates across all users:** See [Cache Management Guide](./CACHE-MANAGEMENT.md) for version bumping strategy.

## Security Notes

- All HTML is sanitized before display
- Script tags, event handlers, and dangerous attributes are stripped
- Only safe formatting tags are allowed
- No user-generated content - only admin-set messages

## Testing Your Intro

1. Set the intro message in the database
2. Wait 5 minutes or force cache refresh
3. Load the document in the browser
4. Verify the intro displays correctly
5. Check browser console for any errors

## Troubleshooting

### Intro not showing
- Check if `intro_message` is NULL for both document and owner
- Verify document is active and has an owner_id
- Force cache refresh via `/api/refresh-registry`
- Clear browser localStorage

### HTML not rendering
- Ensure you're using allowed tags only
- Check for syntax errors (unclosed tags)
- Verify quotes are properly escaped in SQL

### Wrong intro showing
- Document override takes precedence over owner default
- Check which intro_message is set (document vs owner)
- Verify the document's owner_id is correct

## Quick Reference Commands

```sql
-- View all owner intros
SELECT slug, name, LEFT(intro_message, 50) as preview FROM owners;

-- View all document intros  
SELECT slug, title, LEFT(intro_message, 50) as preview FROM documents WHERE intro_message IS NOT NULL;

-- Find documents using owner default (no override)
SELECT d.slug, d.title, o.name as owner 
FROM documents d 
JOIN owners o ON d.owner_id = o.id 
WHERE d.intro_message IS NULL AND o.intro_message IS NOT NULL;

-- Find documents with no intro at all
SELECT d.slug, d.title 
FROM documents d 
LEFT JOIN owners o ON d.owner_id = o.id 
WHERE d.intro_message IS NULL AND o.intro_message IS NULL;
```

---

For detailed technical documentation, see [HTML-INTRO-MESSAGES-FEATURE.md](./HTML-INTRO-MESSAGES-FEATURE.md)

