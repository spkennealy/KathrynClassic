-- Note: golf_teams and golf_team_players tables already exist for tournament-specific leaderboard teams
-- This script adds support for reusable team templates

-- Team templates table - reusable team names/groups that can be used across tournaments
CREATE TABLE IF NOT EXISTS team_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team template members - default members for a team template
CREATE TABLE IF NOT EXISTS team_template_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_template_id UUID NOT NULL REFERENCES team_templates(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  position INTEGER CHECK (position >= 1 AND position <= 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_template_id, contact_id),
  UNIQUE(team_template_id, position)
);

-- Enable RLS
ALTER TABLE team_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_template_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_templates
DROP POLICY IF EXISTS "Allow authenticated users to read team_templates" ON team_templates;
CREATE POLICY "Allow authenticated users to read team_templates"
ON team_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert team_templates" ON team_templates;
CREATE POLICY "Allow authenticated users to insert team_templates"
ON team_templates FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update team_templates" ON team_templates;
CREATE POLICY "Allow authenticated users to update team_templates"
ON team_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete team_templates" ON team_templates;
CREATE POLICY "Allow authenticated users to delete team_templates"
ON team_templates FOR DELETE TO authenticated USING (true);

-- RLS Policies for team_template_members
DROP POLICY IF EXISTS "Allow authenticated users to read team_template_members" ON team_template_members;
CREATE POLICY "Allow authenticated users to read team_template_members"
ON team_template_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert team_template_members" ON team_template_members;
CREATE POLICY "Allow authenticated users to insert team_template_members"
ON team_template_members FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update team_template_members" ON team_template_members;
CREATE POLICY "Allow authenticated users to update team_template_members"
ON team_template_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete team_template_members" ON team_template_members;
CREATE POLICY "Allow authenticated users to delete team_template_members"
ON team_template_members FOR DELETE TO authenticated USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_template_members_template_id ON team_template_members(team_template_id);
CREATE INDEX IF NOT EXISTS idx_team_template_members_contact_id ON team_template_members(contact_id);

-- Create a view for easy team template data retrieval
CREATE OR REPLACE VIEW team_template_details AS
SELECT
  tt.id as team_id,
  tt.name as team_name,
  tt.created_at,
  tt.updated_at,
  COUNT(ttm.id) as member_count,
  ARRAY_AGG(
    json_build_object(
      'contact_id', c.id,
      'first_name', c.first_name,
      'last_name', c.last_name,
      'email', c.email,
      'position', ttm.position
    ) ORDER BY ttm.position
  ) FILTER (WHERE c.id IS NOT NULL) as members
FROM team_templates tt
LEFT JOIN team_template_members ttm ON tt.id = ttm.team_template_id
LEFT JOIN contacts c ON ttm.contact_id = c.id
GROUP BY tt.id, tt.name, tt.created_at, tt.updated_at
ORDER BY tt.name;

COMMENT ON TABLE team_templates IS 'Reusable team templates that can be used to quickly create golf_teams for tournaments';
COMMENT ON TABLE team_template_members IS 'Default members for team templates with positions (1-4)';
COMMENT ON VIEW team_template_details IS 'Convenient view showing team templates with their member details';
