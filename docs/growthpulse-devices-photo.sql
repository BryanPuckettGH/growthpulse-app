-- Device profile photo (optional). A small downscaled JPEG data URL stored on
-- the device row so the picture follows the account across browsers, the same
-- way name/location/group already do. Run once in the Supabase SQL editor.

alter table devices add column if not exists photo text;
