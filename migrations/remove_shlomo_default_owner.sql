-- Remove incorrect Default Owner assignment from shlomo@makerpizza.com
-- This user should only be owner_admin for Maker Pizza

DELETE FROM user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'shlomo@makerpizza.com')
  AND owner_id = (SELECT id FROM owners WHERE slug = 'default')
  AND role = 'owner_admin';

