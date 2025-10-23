UPDATE documents SET is_public = true, requires_auth = false WHERE is_public IS NULL;
