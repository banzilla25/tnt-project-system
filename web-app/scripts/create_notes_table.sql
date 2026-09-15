CREATE TABLE IF NOT EXISTS campaign_creator_notes (
  id SERIAL PRIMARY KEY,
  campaign_creator_id INTEGER REFERENCES campaign_creators(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  isi TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id),
  author_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE campaign_creator_notes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access (since auth is handled in app)
CREATE POLICY "Allow all operations for authenticated users" 
ON campaign_creator_notes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
