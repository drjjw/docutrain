-- Add download URL to Evidence to Action: Obesity Management document
-- Date: 2025-10-20

UPDATE documents 
SET downloads = '[{
  "title": "Download PDF",
  "url": "https://mlxctdgnojvkgfqldaob.supabase.co/storage/v1/object/public/downloads/Evidence-to-Action_Obesity-Management-EN_Sept18_FINAL.pdf"
}]'::jsonb
WHERE slug = 'obesity-management-2024';

-- Verify the update
SELECT slug, title, downloads 
FROM documents 
WHERE slug = 'obesity-management-2024';

