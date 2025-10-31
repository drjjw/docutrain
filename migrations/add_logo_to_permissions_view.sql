-- Add owner_logo_url to user_permissions_summary view
-- This allows the frontend to display owner logos in permission badges

CREATE OR REPLACE VIEW user_permissions_summary AS
-- Global super admins get access to all owners
SELECT
  sa.user_id,
  'super_admin'::TEXT as role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name,
  o.logo_url as owner_logo_url
FROM user_roles sa
CROSS JOIN owners o
WHERE sa.role = 'super_admin' AND sa.owner_id IS NULL
UNION
-- Owner-specific roles
SELECT
  ur.user_id,
  ur.role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name,
  o.logo_url as owner_logo_url
FROM user_roles ur
JOIN owners o ON o.id = ur.owner_id
WHERE ur.owner_id IS NOT NULL
UNION
-- Direct owner access (registered users)
SELECT
  uoa.user_id,
  'registered'::TEXT as role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name,
  o.logo_url as owner_logo_url
FROM user_owner_access uoa
JOIN owners o ON o.id = uoa.owner_id;

