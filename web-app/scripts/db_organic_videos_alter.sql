ALTER TABLE organic_videos ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'Video';

UPDATE organic_videos 
SET content_type = 'Livestream' 
WHERE duration_str LIKE '%h%' OR duration_str LIKE '%min%';

UPDATE organic_videos 
SET content_type = 'Video' 
WHERE content_type IS NULL OR (duration_str NOT LIKE '%h%' AND duration_str NOT LIKE '%min%');
